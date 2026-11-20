use crate::adapters::cloud::http_transport::{HttpRequest, HttpResponse, HttpTransport};
use crate::core::ports::CloudAuthProvider;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// `HttpTransport` decorator that injects a fresh `Authorization: Bearer <token>` header
/// from a `CloudAuthProvider` before delegating each request.
pub struct AuthenticatedHttpTransport {
    inner: Arc<dyn HttpTransport>,
    auth: Arc<dyn CloudAuthProvider>,
    clock: Arc<dyn Fn() -> i64 + Send + Sync>,
}

impl AuthenticatedHttpTransport {
    pub fn new(inner: Arc<dyn HttpTransport>, auth: Arc<dyn CloudAuthProvider>) -> Self {
        let clock = Arc::new(|| {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0)
        });
        Self::with_clock(inner, auth, clock)
    }

    pub fn with_clock(
        inner: Arc<dyn HttpTransport>,
        auth: Arc<dyn CloudAuthProvider>,
        clock: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self { inner, auth, clock }
    }
}

impl HttpTransport for AuthenticatedHttpTransport {
    fn send(&self, mut request: HttpRequest) -> Result<HttpResponse, String> {
        let now_ms = (self.clock)();
        let token = self
            .auth
            .get_valid_access_token(now_ms)
            .map_err(|err| format!("Unauthorized: {err}"))?;
        request.headers.push((
            "Authorization".to_string(),
            format!("Bearer {}", token.access_token),
        ));
        self.inner.send(request)
    }
}
