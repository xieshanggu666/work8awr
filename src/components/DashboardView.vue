<template>
  <div class="dash">
    <div class="dash-grid">
      <!-- 统计卡片 -->
      <div class="stat-card">
        <span class="s-icon">🎯</span>
        <div class="s-num">{{ store.dashboard.totalDraws }}</div>
        <div class="s-lab">累计抽奖</div>
      </div>
      <div class="stat-card">
        <span class="s-icon">👥</span>
        <div class="s-num">{{ store.dashboard.participants }}</div>
        <div class="s-lab">参与人数</div>
      </div>
      <div class="stat-card">
        <span class="s-icon">🟢</span>
        <div class="s-num">{{ store.dashboard.running }}</div>
        <div class="s-lab">运行中活动</div>
      </div>
      <div class="stat-card">
        <span class="s-icon">💎</span>
        <div class="s-num">{{ store.dashboard.legendaryWins }}</div>
        <div class="s-lab">传说中奖</div>
      </div>
      <div class="stat-card">
        <span class="s-icon">🏆</span>
        <div class="s-num">{{ store.dashboard.epicWins }}</div>
        <div class="s-lab">史诗中奖</div>
      </div>
      <div class="stat-card">
        <span class="s-icon">🪙</span>
        <div class="s-num">{{ store.dashboard.pointsIssued }}</div>
        <div class="s-lab">已发放积分</div>
      </div>
      <div class="stat-card">
        <span class="s-icon">🛍️</span>
        <div class="s-num">{{ store.dashboard.goodsSold }}</div>
        <div class="s-lab">兑换商品</div>
      </div>
      <div class="stat-card risk">
        <span class="s-icon">🛡️</span>
        <div class="s-num warn">{{ store.dashboard.pendingRisk }}</div>
        <div class="s-lab">待风控处理</div>
      </div>
      <div class="stat-card risk">
        <span class="s-icon">🧊</span>
        <div class="s-num ice">{{ store.dashboard.frozenPoints }}</div>
        <div class="s-lab">冻结积分</div>
      </div>
    </div>

    <!-- 活动概览 + 库存 -->
    <div class="dash-cards">
      <div class="card">
        <div class="card-title">🛡️ 活动库</div>
        <div v-for="a in store.activities" :key="a.id" class="act-row">
          <span class="a-icon">{{ a.icon }}</span>
          <div class="a-info">
            <div class="a-name">{{ a.name }}</div>
            <div class="a-meta">{{ statusLabel(a.status) }} · {{ a.type==='wheel'?'幸运转盘':'刮刮乐' }} · {{ a.startAt }} ~ {{ a.endAt }}</div>
          </div>
          <span class="a-status" :class="a.status">{{ statusLabel(a.status) }}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📦 奖品库存</div>
        <div v-for="a in store.activities" :key="'st'+a.id" class="stock-block">
          <div class="sb-name">{{ a.name }}</div>
          <div class="sb-list">
            <div v-for="p in a.prizes.filter(x=>x.rarity!=='none')" :key="p.id" class="sb-item">
              <div class="sb-bar">
                <i :style="{ width: p.stock ? (p.remain/p.stock*100)+'%' : '0%' }"></i>
              </div>
              <span class="sb-txt">{{ p.name }} <b>{{ p.remain }}</b>/{{ p.stock
                }}<i v-if="p.frozen" class="sb-frozen">🧊{{ p.frozen }}</i></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中奖记录 -->
    <div class="card full">
      <div class="card-title">🏅 中奖与兑换记录</div>
      <div v-if="store.records.length===0" class="empty">暂无记录</div>
      <div class="rec-row" v-for="r in store.records" :key="r.id" :class="{ revoked: r.status==='revoked' }">
        <span class="r-icon">{{ r.icon }}</span>
        <span class="r-note">{{ r.type==='draw' ? r.prizeName : r.goodsName }}</span>
        <span class="r-src">{{ r.type==='draw' ? r.activityName : '积分商城' }}</span>
        <span class="r-rarity" v-if="r.rarity" :style="{background: rarityColor(r.rarity)}">{{ rarityLabel(r.rarity) }}</span>
        <span v-if="r.status==='frozen'" class="r-badge frozen">🧊 风控审核中</span>
        <span v-else-if="r.status==='released'" class="r-badge released">✅ 审核放行</span>
        <span v-else-if="r.status==='revoked'" class="r-badge revoked">❌ 已撤销</span>
        <span class="r-time">{{ r.date }} {{ r.time }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePlatformStore } from '@/store/platform'
import { PRIZE_RARITY } from '@/mock/data'
const store = usePlatformStore()
const statusLabel = (s) => ({ running: '进行中', paused: '已暂停', ended: '已结束' }[s] || s)
const rarityLabel = (r) => PRIZE_RARITY[r]?.label || r
const rarityColor = (r) => PRIZE_RARITY[r]?.color || '#777'
</script>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 16px; }
.dash-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 900px) { .dash-grid { grid-template-columns: repeat(2, 1fr); } }
.stat-card {
  background: linear-gradient(160deg, #13264f, #0f1b38);
  border: 1px solid rgba(120,160,220,0.16); border-radius: 12px;
  padding: 14px; text-align: center;
}
.s-icon { font-size: 22px; }
.s-num { font-size: 26px; font-weight: 800; color: #4d8dff; margin: 6px 0 0; }
.stat-card.risk { border-color: rgba(255,152,0,0.35); }
.s-num.warn { color: #ffb74d; }
.s-num.ice { color: #81d4fa; }
.s-lab { font-size: 11px; color: #8ba2c8; margin-top: 2px; }

.dash-cards { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
@media (max-width: 900px) { .dash-cards { grid-template-columns: 1fr; } }
.card {
  background: #0f1b38; border: 1px solid rgba(120,160,220,0.16);
  border-radius: 14px; padding: 16px;
}
.card.full { grid-column: 1 / -1; }
.card-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 12px; }

.act-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed rgba(120,160,220,0.12); }
.act-row:last-child { border-bottom: none; }
.a-icon { font-size: 22px; }
.a-info { flex: 1; min-width: 0; }
.a-name { font-size: 13px; color: #e8eefb; }
.a-meta { font-size: 10px; color: #6f84ab; margin-top: 2px; }
.a-status { font-size: 10px; padding: 2px 8px; border-radius: 4px; }
.a-status.running { background: rgba(76,175,80,0.15); color: #7ef0c9; }
.a-status.paused { background: rgba(255,152,0,0.15); color: #ff9800; }
.a-status.ended { background: rgba(158,158,158,0.15); color: #90a4ae; }

.stock-block { margin-bottom: 12px; }
.sb-name { font-size: 12px; color: #8ba2c8; margin-bottom: 6px; font-weight: 600; }
.sb-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 11px; }
.sb-bar { flex: 1; height: 6px; background: #0c1730; border-radius: 3px; overflow: hidden; }
.sb-bar i { display: block; height: 100%; background: linear-gradient(90deg,#4d8dff,#7e9ff5); border-radius: 3px; }
.sb-txt { color: #aebadd; width: 150px; text-align: right; flex-shrink: 0; }
.sb-txt b { color: #ffc107; }
.sb-frozen { color: #81d4fa; font-style: normal; font-size: 10px; margin-left: 5px; }

.empty { color: #5b6f94; text-align: center; padding: 20px; font-size: 12px; }
.rec-row.revoked .r-note { text-decoration: line-through; color: #7e8fa8; }
.r-badge { font-size: 10px; padding: 1px 7px; border-radius: 4px; white-space: nowrap; }
.r-badge.frozen { background: rgba(129,212,250,0.15); color: #81d4fa; }
.r-badge.released { background: rgba(76,175,80,0.15); color: #7ef0c9; }
.r-badge.revoked { background: rgba(144,164,174,0.15); color: #b0bec5; }
.rec-row {
  display: flex; align-items: center; gap: 10px; padding: 7px 0;
  border-bottom: 1px dashed rgba(120,160,220,0.1); font-size: 12px;
}
.rec-row:last-child { border-bottom: none; }
.r-note { flex: 1; color: #e8eefb; }
.r-src { color: #6f84ab; font-size: 11px; }
.r-rarity { font-size: 9px; color: #fff; padding: 1px 6px; border-radius: 3px; }
.r-time { color: #8ba2c8; font-size: 11px; }
</style>