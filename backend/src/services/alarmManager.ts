// ============================================================
//  PyroSense Alarm Manager
//  Hysteresis + cooldown ile alert fatigue önleme
//
//  İki seviyeli eşik:
//    open  (≥ OPEN_THRESHOLD):  alarm AÇ
//    close (<  CLOSE_THRESHOLD): alarm KAPAT
//
//  Cooldown:
//    Alarm kapandıktan sonra COOLDOWN_MS geçmeden tekrar açılmaz
// ============================================================

const OPEN_THRESHOLD = 70; // skor > 75 Alarm ac
const CLOSE_THRESHOLD = 45; // skor < 45 Alarm kapat
const COOLDOWN_MS = 10 * 60 * 1000; // 10 dakika

interface AlarmState {
    active: boolean;
    closedAt: number | null; // epoch ms - son kapanma zamani
}

const states = new Map<string, AlarmState>();

function getState(zoneId: string): AlarmState {
    if (!states.has(zoneId)) {
        states.set(zoneId, { active: false, closedAt: null });
    }
    return states.get(zoneId)!;
}

export interface AlarmDesicion {
    shouldAlert: boolean;
    justOpened: boolean;
    justClosed: boolean;
}

export function evaluateAlarm(zoneId: string, score: number): AlarmDesicion {
    const state = getState(zoneId);
    const now = Date.now();

    let justOpened = false;
    let justClosed = false;

    if (!state.active) {
        // Alarm kapali — acilma kosulunu kontrol et
        const cooledDown = state.closedAt == null || now - state.closedAt >= COOLDOWN_MS;
        if (score >= OPEN_THRESHOLD && cooledDown) {
            state.active = true;
            justOpened = true;
        }
    } else {
        // Alarm acik — kapanma kosulunu kontrol et
        if (score < CLOSE_THRESHOLD) {
            state.active = false;
            state.closedAt = now;
            justClosed = true;
        }
    }
    return {
        shouldAlert: state.active,
        justOpened,
        justClosed,
    };
}

// Test - Debug icin
export function getAlarmState(zoneId: string): AlarmState {
    return getState(zoneId);
}
