//! Every ingress hands its request to the [`Router`], which asks one [`Answerer`] under one
//! timeout budget. Ingresses set the requester; answerers never trust the wire for it.

use std::{
    sync::Arc,
    time::{Duration, SystemTime},
};

use async_trait::async_trait;
use tokio::time::timeout;

use crate::{
    protocol::{ApprovalPrompt, CredentialData, CredentialQuery, Purpose},
    requester::Requester,
};

/// Covers unlocking, reading the dialog and answering it.
pub const BUDGET: Duration = Duration::from_secs(60);

#[derive(Debug, Clone)]
pub enum RequestKind {
    Credential {
        query: CredentialQuery,
        purpose: Option<Purpose>,
    },
    Approval {
        prompt: ApprovalPrompt,
    },
    /// From the SSH agent, which knows only the peer's process name.
    SshSign {
        cipher_id: String,
        /// SSHSIG namespace; `None` for an SSH login.
        namespace: Option<String>,
        is_forwarding: bool,
        host_fingerprint: Option<String>,
    },
}

#[derive(Debug, Clone)]
pub struct AgentRequest {
    /// The client's `requestId`; not unique across clients.
    pub request_id: String,
    pub kind: RequestKind,
    pub requester: Requester,
    /// When the router stops waiting; answerers should close their UI by then.
    pub deadline: SystemTime,
}

#[derive(Debug)]
pub enum Outcome {
    /// Carries the released credential for credential requests, nothing for approvals.
    Approved(Option<CredentialData>),
    Denied,
    NotFound,
    Locked,
    Timeout,
    Error,
}

#[async_trait]
pub trait Answerer: Send + Sync + 'static {
    async fn answer(&self, request: AgentRequest) -> Outcome;
}

pub struct Router {
    desktop: Arc<dyn Answerer>,
    /// Slot for the phone (desktop as AAP RemoteClient), asked when the desktop is locked.
    escalation: Option<Arc<dyn Answerer>>,
    budget: Duration,
}

impl Router {
    pub fn new(desktop: Arc<dyn Answerer>) -> Self {
        Self {
            desktop,
            escalation: None,
            budget: BUDGET,
        }
    }

    pub async fn route(
        &self,
        request_id: String,
        kind: RequestKind,
        requester: Requester,
    ) -> Outcome {
        let request = AgentRequest {
            request_id,
            kind,
            requester,
            deadline: SystemTime::now() + self.budget,
        };

        timeout(self.budget, self.answer(request))
            .await
            .unwrap_or(Outcome::Timeout)
    }

    async fn answer(&self, request: AgentRequest) -> Outcome {
        let Some(phone) = &self.escalation else {
            return self.desktop.answer(request).await;
        };

        match self.desktop.answer(request.clone()).await {
            Outcome::Locked => phone.answer(request).await,
            outcome => outcome,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::requester::{App, Requester};

    struct Fixed(fn() -> Outcome);

    #[async_trait]
    impl Answerer for Fixed {
        async fn answer(&self, _request: AgentRequest) -> Outcome {
            (self.0)()
        }
    }

    struct Never;

    #[async_trait]
    impl Answerer for Never {
        async fn answer(&self, _request: AgentRequest) -> Outcome {
            std::future::pending().await
        }
    }

    fn requester() -> Requester {
        Requester {
            app: App {
                name: "test".into(),
                pid: 1,
                exe: None,
                signer: None,
            },
            chain: vec![],
            bundled_cli: false,
        }
    }

    async fn route(router: &Router) -> Outcome {
        let kind = RequestKind::Approval {
            prompt: ApprovalPrompt {
                title: "t".into(),
                body: None,
            },
        };
        router.route("r".into(), kind, requester()).await
    }

    #[tokio::test]
    async fn test_returns_the_desktop_answer() {
        let router = Router::new(Arc::new(Fixed(|| Outcome::Denied)));

        assert!(matches!(route(&router).await, Outcome::Denied));
    }

    #[tokio::test]
    async fn test_times_out_after_the_budget() {
        let router = Router {
            budget: Duration::from_millis(10),
            ..Router::new(Arc::new(Never))
        };

        assert!(matches!(route(&router).await, Outcome::Timeout));
    }

    #[tokio::test]
    async fn test_escalates_only_when_locked() {
        let phone: Arc<dyn Answerer> = Arc::new(Fixed(|| Outcome::Approved(None)));
        let locked = Router {
            escalation: Some(phone.clone()),
            ..Router::new(Arc::new(Fixed(|| Outcome::Locked)))
        };
        let denied = Router {
            escalation: Some(phone),
            ..Router::new(Arc::new(Fixed(|| Outcome::Denied)))
        };

        assert!(matches!(route(&locked).await, Outcome::Approved(None)));
        assert!(matches!(route(&denied).await, Outcome::Denied));
    }
}
