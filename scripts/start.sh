#!/bin/bash
# ============================================================
#  PyroSense — Başlatma Betiği
#  Kullanım: ./scripts/start.sh
# ============================================================

set -e

FUSEKI_URL="http://localhost:3030"
FUSEKI_PASS="pyrosense123"
DATASET="pyrosense"

echo "🔥 PyroSense başlatılıyor..."

# 1. Altyapıyı başlat
echo "📦 Docker servisleri başlatılıyor..."
docker compose up -d

# 2. Fuseki hazır olana kadar bekle (timeout: 60s)
echo "⏳ Fuseki bekleniyor..."
RETRY=0
until curl -s -o /dev/null -w "%{http_code}" \
      -u "admin:${FUSEKI_PASS}" "${FUSEKI_URL}/\$/ping" | grep -q "200"; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge 30 ]; then
    echo "❌ Fuseki 60 saniyede hazır olmadı. Logları kontrol et:"
    echo "   docker logs pyrosense-fuseki"
    exit 1
  fi
  sleep 2
done
echo "✅ Fuseki hazır"

# 3. Dataset oluştur (zaten varsa hata vermez)
echo "🧠 Dataset oluşturuluyor: ${DATASET}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${FUSEKI_URL}/\$/datasets" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "admin:${FUSEKI_PASS}" \
  --data "dbName=${DATASET}&dbType=tdb2")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "409" ]; then
  echo "✅ Dataset hazır (HTTP $HTTP_STATUS)"
else
  echo "❌ Dataset oluşturulamadı (HTTP $HTTP_STATUS)"
  exit 1
fi

# 4. OWL ontolojisini Fuseki'ye yükle
echo "📚 Ontoloji yükleniyor..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${FUSEKI_URL}/${DATASET}/data" \
  -H "Content-Type: text/turtle" \
  -u "admin:${FUSEKI_PASS}" \
  --data-binary @ontology/pyrosense-core.owl)

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo "✅ Ontoloji yüklendi (HTTP $HTTP_STATUS)"
else
  echo "⚠️  Ontoloji yükleme başarısız (HTTP $HTTP_STATUS) — elle yükleyebilirsin:"
  echo "   Fuseki UI → http://localhost:3030 → dataset: ${DATASET} → Upload data"
fi

# 5. Doğrulama: SPARQL ile sınıf sayısını sorgula
echo "🔍 Ontoloji doğrulanıyor..."
RESULT=$(curl -s -G "${FUSEKI_URL}/${DATASET}/sparql" \
  -u "admin:${FUSEKI_PASS}" \
  --data-urlencode "query=SELECT (COUNT(?c) AS ?count) WHERE { ?c a <http://www.w3.org/2002/07/owl#Class> }" \
  -H "Accept: application/sparql-results+json")

echo "   SPARQL yanıtı: $RESULT"

echo ""
echo "✅ PyroSense hazır!"
echo ""
echo "📊 Servis adresleri:"
echo "   MQTT Broker:    mqtt://localhost:1883"
echo "   Fuseki UI:      http://localhost:3030  (admin / pyrosense123)"
echo "   Fuseki SPARQL:  http://localhost:3030/${DATASET}/sparql"
echo "   MongoDB UI:     http://localhost:8081"
echo "   PostgreSQL:     localhost:5432"
echo ""
echo "🚀 Simülatörü başlatmak için:"
echo "   cd simulator && cargo run"
echo ""
echo "🔄 Senaryo değiştirmek için:"
echo "   curl -X POST http://localhost:8090/scenario \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"scenario\": \"prefire\", \"zone_id\": \"zone_a\"}'"
echo ""
echo "🛑 Durdurmak için:"
echo "   docker compose down"
