<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🎲</span>
        <div>
          <h1>抽奖与积分运营平台</h1>
          <p>Lottery &amp; Points Platform</p>
        </div>
      </div>
      <nav class="tabs">
        <button v-for="t in tabs" :key="t.key" :class="{ active: tab === t.key }" @click="tab = t.key">
          {{ t.label }}
          <i v-if="t.key === 'risk' && store.pendingRiskCount" class="tab-badge">{{ store.pendingRiskCount }}</i>
        </button>
      </nav>
      <div class="user">
        <span class="u-avatar">{{ store.user.avatar }}</span>
        <span class="u-name">{{ store.user.name }}</span>
        <span class="u-points">🪙 {{ store.points }}</span>
        <span v-if="store.frozenPoints > 0" class="u-frozen" title="风控冻结中的积分">🧊 {{ store.frozenPoints }}</span>
      </div>
    </header>

    <main class="content">
      <!-- 抽奖首页 -->
      <div v-if="tab === 'home'">
        <div class="activity-switch">
          <span class="switch-label">选择活动：</span>
          <button
            v-for="a in store.activities"
            :key="a.id"
            class="act-tab"
            :class="{ active: currentActivityId === a.id }"
            @click="currentActivityId = a.id"
          >{{ a.icon }} {{ a.name }}</button>
        </div>
        <ActivityView v-if="currentActivity" :key="currentActivity.id" :activity="currentActivity" />
      </div>

      <PointsCenter v-else-if="tab === 'points'" />
      <RiskCenter v-else-if="tab === 'risk'" />
      <DashboardView v-else-if="tab === 'dashboard'" />
      <AdminView v-else-if="tab === 'admin'" />

      <p v-if="currentActivity && !activeExists" class="none-tip">暂无进行中的活动，请在「活动管理」中创建。</p>
    </main>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="store.toast" class="toast" :class="store.toast.type" @click="store.clearToast()">
        {{ store.toast.msg }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePlatformStore } from '@/store/platform'
import ActivityView from '@/components/ActivityView.vue'
import PointsCenter from '@/components/PointsCenter.vue'
import RiskCenter from '@/components/RiskCenter.vue'
import DashboardView from '@/components/DashboardView.vue'
import AdminView from '@/components/AdminView.vue'

const store = usePlatformStore()
const tab = computed({
  get: () => store.activeTab,
  set: (v) => { store.activeTab = v }
})
const currentActivityId = ref('act-1')

const tabs = [
  { key: 'home', label: '🎡 抽奖活动' },
  { key: 'points', label: '🪙 积分中心' },
  { key: 'risk', label: '🛡️ 风控申诉' },
  { key: 'dashboard', label: '📊 运营看板' },
  { key: 'admin', label: '🎛️ 活动管理' }
]

const currentActivity = computed(() => store.activities.find((a) => a.id === currentActivityId.value))
const activeExists = computed(() => store.activities.some((a) => a.status === 'running'))

onMounted(() => {
  store.init()
  if (store.activities.length) currentActivityId.value = store.activities[0].id
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a1224, #0d1730);
  color: #dbe4f3;
}
.topbar {
  display: flex; align-items: center; gap: 24px;
  padding: 14px 24px;
  background: #0c1730;
  border-bottom: 1px solid rgba(120,160,220,0.18);
  position: sticky; top: 0; z-index: 20;
  flex-wrap: wrap;
}
.brand { display: flex; align-items: center; gap: 10px; }
.logo {
  width: 40px; height: 40px; border-radius: 10px;
  display: grid; place-items: center; font-size: 22px;
  background: linear-gradient(135deg, #ff7043, #e53935);
  box-shadow: 0 4px 12px rgba(229,57,53,0.5);
}
.brand h1 { font-size: 16px; margin: 0; color: #fff; }
.brand p { font-size: 10px; margin: 0; color: #6f84ab; letter-spacing: 1px; }

.tabs { display: flex; gap: 6px; }
.tabs button {
  background: transparent; border: 1px solid transparent; color: #8ba2c8;
  padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.tabs button:hover { color: #fff; background: #13233f; }
.tabs button.active {
  background: linear-gradient(135deg,#1d3f8f,#2962ff); color: #fff;
  box-shadow: 0 3px 10px rgba(41,98,255,0.35);
}
.user { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.u-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: #13233f;
  display: grid; place-items: center; font-size: 18px;
}
.u-name { font-size: 13px; color: #dbe4f3; }
.u-points {
  background: rgba(255,193,7,0.15); color: #ffd54f; border-radius: 12px;
  padding: 4px 12px; font-size: 13px; font-weight: 700;
}
.u-frozen {
  background: rgba(129,212,250,0.15); color: #81d4fa; border-radius: 12px;
  padding: 4px 12px; font-size: 13px; font-weight: 700;
}
.tabs button { position: relative; }
.tab-badge {
  position: absolute; top: -6px; right: -2px;
  background: #ff5252; color: #fff; font-style: normal;
  font-size: 10px; line-height: 1; padding: 3px 5px; border-radius: 8px;
  box-shadow: 0 2px 6px rgba(255,82,82,0.5);
}

.content { max-width: 1200px; margin: 0 auto; padding: 24px; }
.activity-switch { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.switch-label { font-size: 13px; color: #8ba2c8; }
.act-tab {
  background: #13233f; border: 1px solid rgba(120,160,220,0.2); color: #aebadd;
  padding: 8px 14px; border-radius: 9px; cursor: pointer; font-size: 13px;
}
.act-tab.active { background: linear-gradient(135deg,#1d3f8f,#2962ff); color: #fff; border-color: transparent; }
.none-tip { text-align: center; color: #5b6f94; padding: 30px; }

.toast {
  position: fixed; right: 24px; top: 80px; z-index: 50;
  padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); cursor: pointer;
  max-width: 320px;
}
.toast.success { background: #1b5e20; color: #c8e6c9; border: 1px solid #388e3c; }
.toast.warn { background: #e65100; color: #ffe0b2; border: 1px solid #f57c00; }
.toast.info { background: #0d47a1; color: #bbdefb; border: 1px solid #1976d2; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-10px); }
</style>