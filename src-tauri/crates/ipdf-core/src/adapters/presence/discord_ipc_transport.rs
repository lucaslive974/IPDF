use std::io::{Read, Write};

pub const OP_HANDSHAKE: u32 = 0;
pub const OP_FRAME: u32 = 1;
pub const OP_CLOSE: u32 = 2;
pub const OP_PING: u32 = 3;
pub const OP_PONG: u32 = 4;

pub trait DiscordIpcTransport: Send {
    fn is_connected(&self) -> bool;
    fn connect(&mut self) -> Result<(), String>;
    fn send_frame(&mut self, opcode: u32, payload: &str) -> Result<String, String>;
    fn disconnect(&mut self);
}

pub struct NativeDiscordIpcTransport {
    #[cfg(unix)]
    stream: Option<std::os::unix::net::UnixStream>,
    #[cfg(unix)]
    custom_socket_path: Option<std::path::PathBuf>,
    #[cfg(not(unix))]
    stream: Option<()>,
}

impl Default for NativeDiscordIpcTransport {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeDiscordIpcTransport {
    pub fn new() -> Self {
        Self {
            #[cfg(unix)]
            stream: None,
            #[cfg(unix)]
            custom_socket_path: None,
            #[cfg(not(unix))]
            stream: None,
        }
    }

    #[cfg(unix)]
    pub fn with_socket_path(path: impl Into<std::path::PathBuf>) -> Self {
        Self {
            stream: None,
            custom_socket_path: Some(path.into()),
        }
    }

    #[cfg(unix)]
    fn find_unix_socket() -> Option<std::path::PathBuf> {
        let xdg = std::env::var("XDG_RUNTIME_DIR").ok();
        let tmp = std::env::var("TMPDIR").ok();
        let uid = libc_getuid();
        let run_user = format!("/run/user/{uid}");

        let candidate_dirs = [
            xdg.as_deref(),
            Some(run_user.as_str()),
            tmp.as_deref(),
            Some("/tmp"),
        ];

        for dir in candidate_dirs.into_iter().flatten() {
            let base = std::path::Path::new(dir);
            for i in 0..10 {
                let candidate = base.join(format!("discord-ipc-{i}"));
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
        None
    }
}

#[cfg(unix)]
fn libc_getuid() -> u32 {
    std::fs::metadata("/proc/self")
        .map(|_| 1000)
        .unwrap_or(1000)
}

impl DiscordIpcTransport for NativeDiscordIpcTransport {
    fn is_connected(&self) -> bool {
        self.stream.is_some()
    }

    #[cfg(unix)]
    fn connect(&mut self) -> Result<(), String> {
        if self.stream.is_some() {
            return Ok(());
        }

        let socket_path = match &self.custom_socket_path {
            Some(path) => path.clone(),
            None => Self::find_unix_socket()
                .ok_or_else(|| "Discord IPC socket not found".to_string())?,
        };

        let stream =
            std::os::unix::net::UnixStream::connect(socket_path).map_err(|e| e.to_string())?;
        stream
            .set_read_timeout(Some(std::time::Duration::from_millis(500)))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(std::time::Duration::from_millis(500)))
            .map_err(|e| e.to_string())?;

        self.stream = Some(stream);
        Ok(())
    }

    #[cfg(not(unix))]
    fn connect(&mut self) -> Result<(), String> {
        // Fallback for non-unix when Discord Named Pipe is not active
        Err("Discord IPC transport not supported on this platform".to_string())
    }

    #[cfg(unix)]
    fn send_frame(&mut self, opcode: u32, payload: &str) -> Result<String, String> {
        let stream = self
            .stream
            .as_mut()
            .ok_or_else(|| "Transport not connected".to_string())?;

        let payload_bytes = payload.as_bytes();
        let length = payload_bytes.len() as u32;

        stream
            .write_all(&opcode.to_le_bytes())
            .map_err(|e| e.to_string())?;
        stream
            .write_all(&length.to_le_bytes())
            .map_err(|e| e.to_string())?;
        stream.write_all(payload_bytes).map_err(|e| e.to_string())?;
        stream.flush().map_err(|e| e.to_string())?;

        // Read response header: 4 bytes opcode + 4 bytes length
        let mut header = [0u8; 8];
        stream.read_exact(&mut header).map_err(|e| e.to_string())?;

        let resp_length = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
        let mut resp_buf = vec![0u8; resp_length];
        stream
            .read_exact(&mut resp_buf)
            .map_err(|e| e.to_string())?;

        String::from_utf8(resp_buf).map_err(|e| e.to_string())
    }

    #[cfg(not(unix))]
    fn send_frame(&mut self, _opcode: u32, _payload: &str) -> Result<String, String> {
        Err("Transport not connected".to_string())
    }

    fn disconnect(&mut self) {
        self.stream = None;
    }
}
