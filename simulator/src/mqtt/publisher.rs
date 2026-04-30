// ============================================================
//  PyroSense MQTT Yayıncısı
//  Bağlantı kurulana kadar bekler, kopunca otomatik yeniden bağlanır
// ============================================================

use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS};
use std::time::Duration;
use tokio::sync::watch;
use tracing::{error, info, warn};

pub struct MqttPublisher {
    client: AsyncClient,
    connected_rx: watch::Receiver<bool>,
}

impl MqttPublisher {
    /// Broker'a bağlan, Connected event gelene kadar bekle (max 30s)
    pub async fn new(broker_host: &str, broker_port: u16, client_id: &str) -> Self {
        let mut mqtt_opts = MqttOptions::new(client_id, broker_host, broker_port);
        mqtt_opts.set_keep_alive(Duration::from_secs(30));
        mqtt_opts.set_clean_session(true);

        let (client, mut event_loop) = AsyncClient::new(mqtt_opts, 100);

        // Bağlantı durumunu paylaşmak için channel
        let (connected_tx, connected_rx) = watch::channel(false);

        // Event loop'u arka planda çalıştır
        tokio::spawn(async move {
            loop {
                match event_loop.poll().await {
                    Ok(Event::Incoming(Incoming::ConnAck(_))) => {
                        info!("MQTT broker'a bağlandı ✓");
                        let _ = connected_tx.send(true);
                    }
                    Ok(_) => {} // Diğer eventler sessizce geçilir
                    Err(e) => {
                        warn!("MQTT bağlantı hatası: {:?} — 3s sonra yeniden denenecek", e);
                        let _ = connected_tx.send(false);
                        tokio::time::sleep(Duration::from_secs(3)).await;
                    }
                }
            }
        });

        // Connected event'i bekle (max 30 saniye)
        let publisher = Self {
            client,
            connected_rx,
        };
        publisher.wait_for_connection(30).await;
        publisher
    }

    /// Bağlantı kurulana kadar bekle
    async fn wait_for_connection(&self, timeout_secs: u64) {
        let deadline = tokio::time::Instant::now() + Duration::from_secs(timeout_secs);

        loop {
            if *self.connected_rx.borrow() {
                return;
            }
            if tokio::time::Instant::now() >= deadline {
                warn!(
                    "MQTT bağlantısı {}s içinde kurulamadı — \
                     Mosquitto çalışıyor mu? (docker ps | grep mosquitto)",
                    timeout_secs
                );
                return;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }

    /// Sensör verisini MQTT'ye yayınla
    /// Bağlantı yoksa sessizce atlar (log yazılır)
    pub async fn publish(&self, topic: &str, payload: &str) -> bool {
        // Bağlantı yoksa yayın yapma
        if !*self.connected_rx.borrow() {
            warn!("MQTT bağlantısı yok — yayın atlandı: {}", topic);
            return false;
        }

        match self
            .client
            .publish(topic, QoS::AtLeastOnce, false, payload.as_bytes())
            .await
        {
            Ok(_) => {
                info!("→ MQTT [{}]: {} byte", topic, payload.len());
                true
            }
            Err(e) => {
                error!("MQTT yayın hatası [{}]: {:?}", topic, e);
                false
            }
        }
    }
}
