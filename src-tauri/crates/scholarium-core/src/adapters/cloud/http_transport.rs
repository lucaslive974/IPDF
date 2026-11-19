use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpMethod {
    Get,
    Post,
    Patch,
    Delete,
}

#[derive(Debug, Clone)]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl HttpResponse {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }
}

/// Synchronous, mockable HTTP transport trait used by cloud auth and storage adapters.
pub trait HttpTransport: Send + Sync {
    fn send(&self, request: HttpRequest) -> Result<HttpResponse, String>;
}

/// Production HTTP transport backed by `ureq` (pure-Rust rustls, desktop + mobile compatible).
pub struct UreqHttpTransport {
    agent: ureq::Agent,
}

impl Default for UreqHttpTransport {
    fn default() -> Self {
        Self::new()
    }
}

impl UreqHttpTransport {
    pub fn new() -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(60)))
            .http_status_as_error(false)
            .build();
        Self {
            agent: config.into(),
        }
    }
}

impl HttpTransport for UreqHttpTransport {
    fn send(&self, request: HttpRequest) -> Result<HttpResponse, String> {
        let response = match request.method {
            HttpMethod::Get => {
                let mut req = self.agent.get(&request.url);
                for (k, v) in &request.headers {
                    req = req.header(k, v);
                }
                req.call().map_err(|e| e.to_string())?
            }
            HttpMethod::Delete => {
                let mut req = self.agent.delete(&request.url);
                for (k, v) in &request.headers {
                    req = req.header(k, v);
                }
                req.call().map_err(|e| e.to_string())?
            }
            HttpMethod::Post => {
                let mut req = self.agent.post(&request.url);
                for (k, v) in &request.headers {
                    req = req.header(k, v);
                }
                req.send(&request.body[..]).map_err(|e| e.to_string())?
            }
            HttpMethod::Patch => {
                let mut req = self.agent.patch(&request.url);
                for (k, v) in &request.headers {
                    req = req.header(k, v);
                }
                req.send(&request.body[..]).map_err(|e| e.to_string())?
            }
        };

        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .filter_map(|(k, v)| {
                v.to_str()
                    .ok()
                    .map(|val| (k.as_str().to_string(), val.to_string()))
            })
            .collect();
        let body = response
            .into_body()
            .read_to_vec()
            .map_err(|e| e.to_string())?;

        Ok(HttpResponse {
            status,
            headers,
            body,
        })
    }
}
