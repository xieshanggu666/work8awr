import { defineStore } from 'pinia'
import { ACTIVITIES, TASKS, SHOP_GOODS, DEMO_USER, DEFAULT_RISK_RULES } from '@/mock/data'

// 加权随机抽取（按权重选一个奖品下标）
function drawByWeight(prizes) {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < prizes.length; i++) {
    r -= prizes[i].weight
    if (r < 0) return i
  }
  return prizes.length - 1
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
// 今天某时刻（h:m）的时间戳，用于构造演示数据/风控窗口比较
function todayAt(h, m = 0) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

// 风控规则文案
const RULE_LABELS = {
  blacklist: '黑名单用户',
  highValue: '高价值奖品/兑换',
  dailyBurst: '当日抽奖频次超限',
  rapidDraw: '短时间连续抽奖',
  rapidRedeem: '短时间连续兑换'
}
export const RISK_RULE_LABELS = RULE_LABELS

// 审核单状态文案与样式标记
export const RISK_STATUS = {
  pending: { label: '待审核', tone: 'warn' },
  appealed: { label: '已申诉', tone: 'info' },
  released: { label: '已放行', tone: 'ok' },
  revoked: { label: '已撤销', tone: 'bad' }
}

let seq = 0
const genId = (p) => `${p}-${Date.now()}-${seq++}`

export const usePlatformStore = defineStore('platform', {
  state: () => ({
    user: { ...DEMO_USER },
    role: 'user',               // user | operator：演示角色（用户申诉 / 运营审核）
    points: 0,                  // 用户可用积分（冻结部分不计入）
    activities: [],             // 深拷贝
    tasks: [],                  // 深拷贝（含完成状态）
    goods: [],                  // 商城商品（响应式库存 + 预占）
    records: [],                // 抽奖 / 兑换业务记录（含 frozen/released/revoked 状态）
    pointRecords: [],           // 积分流水（append-only）
    riskOrders: [],             // 风控审核单
    auditLogs: [],              // 操作记录（审计日志）
    riskRules: { ...DEFAULT_RISK_RULES, blacklist: [...DEFAULT_RISK_RULES.blacklist] },
    todayDate: todayStr(),
    activeTab: 'home',
    toast: null
  }),

  getters: {
    // 是否运营身份
    isOperator: (s) => s.role === 'operator',
    // 冻结中的积分（抽奖成本 + 兑换成本；抽奖积分奖品在放行时才入账）
    frozenPoints(s) {
      return s.riskOrders
        .filter((o) => o.status === 'pending' || o.status === 'appealed')
        .reduce((sum, o) => sum + (o.frozenPoints || 0), 0)
    },
    // 每日抽奖次数（已撤销不计入：撤销后返还限次；待审核/已放行均占用次数）
    dailyDrawCount: (s) => (activityId) =>
      s.records.filter(
        (r) => r.type === 'draw' && r.activityId === activityId &&
          r.date === s.todayDate && r.status !== 'revoked'
      ).length,
    // 总抽奖次数统计
    totalDrawCount: (s) => (activityId) =>
      s.records.filter(
        (r) => r.type === 'draw' && r.activityId === activityId && r.status !== 'revoked'
      ).length,
    // 有效业务记录（已撤销不计入业务与统计）
    validRecords(s) {
      return s.records.filter((r) => r.status !== 'revoked')
    },
    // 待处理审核单数（用户端/运营端角标）
    pendingRiskCount(s) {
      return s.riskOrders.filter((o) => o.status === 'pending' || o.status === 'appealed').length
    },
    // 运营看板统计（同步冻结/撤销状态）
    dashboard(state) {
      const draws = state.records.filter((r) => r.type === 'draw' && r.status !== 'revoked')
      return {
        totalDraws: draws.length,
        running: state.activities.filter((a) => a.status === 'running').length,
        participants: Math.round(draws.length * 1.7) + 128,
        legendaryWins: draws.filter((r) => r.rarity === 'legendary').length,
        epicWins: draws.filter((r) => r.rarity === 'epic').length,
        pointsIssued: state.pointRecords
          .filter((p) => p.delta > 0 && p.kind !== 'refund')
          .reduce((s, p) => s + p.delta, 0),
        goodsSold: state.records.filter((r) => r.type === 'redeem' && r.status !== 'revoked').length,
        pendingRisk: state.riskOrders.filter((o) => o.status === 'pending' || o.status === 'appealed').length,
        frozenPoints: state.riskOrders
          .filter((o) => o.status === 'pending' || o.status === 'appealed')
          .reduce((sum, o) => sum + (o.frozenPoints || 0), 0)
      }
    }
  },

  actions: {
    init() {
      this.activities = ACTIVITIES.map((a) => ({
        ...a,
        prizes: a.prizes.map((p) => ({ ...p, frozen: 0 }))
      }))
      this.tasks = TASKS.map((t) => ({
        ...t,
        done: false,
        claimed: false
      }))
      this.goods = SHOP_GOODS.map((g) => ({ ...g, frozen: 0 }))
      this.seedRiskData()
    },

    showToast(msg, type = 'info') {
      this.toast = { msg, type, id: Date.now() }
    },
    clearToast() {
      this.toast = null
    },

    gotoTab(tab) {
      this.activeTab = tab
    },

    // ===== 角色切换（演示权限） =====
    setRole(role) {
      this.role = role
      this.addAuditLog('switch-role', null, `切换为${role === 'operator' ? '运营' : '用户'}视角`)
      this.showToast(`已切换为${role === 'operator' ? '运营审核' : '普通用户'}视角`, 'info')
    },

    // ===== 积分流水（append-only，禁止改写历史行） =====
    addPointRecord(delta, note, kind = 'normal') {
      this.pointRecords.unshift({
        id: genId('pr'),
        date: this.todayDate,
        time: nowTime(),
        ts: Date.now(),
        delta,
        balance: this.points,
        note,
        kind // normal | frozen | release | refund | reward
      })
      if (this.pointRecords.length > 200) this.pointRecords.pop()
    },

    // ===== 操作记录（审计日志） =====
    addAuditLog(action, orderId, detail) {
      this.auditLogs.unshift({
        id: genId('log'),
        action,                                   // freeze/release/revoke/appeal/config/switch-role
        actionLabel: {
          freeze: '风控冻结',
          release: '审核放行',
          revoke: '审核撤销',
          appeal: '用户申诉',
          config: '规则变更',
          'switch-role': '视角切换'
        }[action] || action,
        orderId: orderId || '',
        operator: this.role === 'operator' ? `运营(${this.user.name})` : this.user.name,
        detail,
        date: this.todayDate,
        time: nowTime()
      })
      if (this.auditLogs.length > 200) this.auditLogs.pop()
    },

    // ===== 风控规则评估 =====
    // 抽奖：返回命中的规则 code 列表
    evalDrawRisk(activity, prize) {
      const hit = []
      const r = this.riskRules
      if (!r.enabled) return hit
      if (r.blacklist.includes(this.user.id)) hit.push('blacklist')
      if (r.highValueRarities.includes(prize.rarity)) hit.push('highValue')
      // 当日频次：含本次将达到阈值
      const todayCount = this.dailyDrawCount(activity.id)
      if (r.dailyDrawThreshold > 0 && todayCount + 1 >= r.dailyDrawThreshold) hit.push('dailyBurst')
      // 短时连抽
      if (r.rapidDrawSeconds > 0 && r.rapidDrawMax > 0) {
        const since = Date.now() - r.rapidDrawSeconds * 1000
        const recent = this.records.filter(
          (x) => x.type === 'draw' && x.status !== 'revoked' && x.ts && x.ts >= since
        ).length
        if (recent + 1 >= r.rapidDrawMax) hit.push('rapidDraw')
      }
      return hit
    },
    // 兑换：返回命中的规则 code 列表
    evalRedeemRisk(goods) {
      const hit = []
      const r = this.riskRules
      if (!r.enabled) return hit
      if (r.blacklist.includes(this.user.id)) hit.push('blacklist')
      if (goods.cost >= r.highValueRedeemCost) hit.push('highValue')
      if (r.rapidRedeemSeconds > 0 && r.rapidRedeemMax > 0) {
        const since = Date.now() - r.rapidRedeemSeconds * 1000
        const recent = this.records.filter(
          (x) => x.type === 'redeem' && x.status !== 'revoked' && x.ts && x.ts >= since
        ).length
        if (recent + 1 >= r.rapidRedeemMax) hit.push('rapidRedeem')
      }
      return hit
    },

    // ===== 抽奖 =====
    draw(activityId) {
      const act = this.activities.find((a) => a.id === activityId)
      if (!act || act.status !== 'running') {
        this.showToast('活动未在运行', 'warn')
        return null
      }
      // 每日限抽
      if (this.dailyDrawCount(activityId) >= act.dailyLimit) {
        this.showToast(`今日已达抽奖上限（${act.dailyLimit} 次）`, 'warn')
        return null
      }
      // 总限抽
      if (this.totalDrawCount(activityId) >= act.totalLimit) {
        this.showToast(`累计已达抽奖上限（${act.totalLimit} 次）`, 'warn')
        return null
      }
      // 可抽取奖品（排除库存为 0 的实物，但"谢谢参与"始终保留）
      const drawable = act.prizes.filter((p) => p.remain > 0 || p.rarity === 'none')
      if (!drawable.length) {
        this.showToast('奖品已抽完', 'warn')
        return null
      }
      const idx = drawByWeight(drawable)
      const prize = drawable[idx]
      // 积分成本校验（先校验后扣减，避免无奖品时误扣）
      const cost = act.costType === 'points' ? act.cost : 0
      if (cost > 0 && this.points < cost) {
        this.showToast('积分不足，无法参与', 'warn')
        return null
      }

      // 风控评估（在任何扣减发生之前，杜绝部分扣减）
      const riskHits = this.evalDrawRisk(act, prize)
      if (riskHits.length) {
        return this.freezeDraw(act, prize, cost, riskHits)
      }

      // 正常放行
      if (cost > 0) {
        this.points -= cost
        this.addPointRecord(-cost, `参与活动【${act.name}】`)
      }
      this.saveDayLog()
      if (prize.rarity !== 'none') {
        const orig = act.prizes.find((p) => p.id === prize.id)
        orig.remain -= 1
      }
      let pointDelta = 0
      if (prize.name.includes('积分')) {
        pointDelta = parseInt(prize.name) || 0
        this.points += pointDelta
      }

      const rec = {
        id: genId('r'),
        type: 'draw',
        status: 'normal',          // normal | frozen | released | revoked
        date: this.todayDate,
        time: nowTime(),
        ts: Date.now(),
        activityId: act.id,
        activityName: act.name,
        prizeId: prize.id,
        prizeName: prize.name,
        rarity: prize.rarity,
        icon: prize.emoji
      }
      this.records.unshift(rec)
      if (pointDelta) this.addPointRecord(pointDelta, `抽奖获得：${prize.name}`, 'reward')
      if (prize.rarity === 'legendary') this.showToast(`🎉 传说大奖！${prize.name}`, 'success')
      else this.showToast(`获得：${prize.name}`, 'success')
      return rec
    },

    // 冻结抽奖：占用成本积分 + 预占奖品库存，建立审核单
    freezeDraw(act, prize, cost, riskHits) {
      if (cost > 0) {
        this.points -= cost
        this.addPointRecord(-cost, `冻结：参与【${act.name}】待风控审核`, 'frozen')
      }
      if (prize.rarity !== 'none') {
        const orig = act.prizes.find((p) => p.id === prize.id)
        orig.remain -= 1
        orig.frozen += 1
      }
      const rec = {
        id: genId('r'),
        type: 'draw',
        status: 'frozen',
        date: this.todayDate,
        time: nowTime(),
        ts: Date.now(),
        activityId: act.id,
        activityName: act.name,
        prizeId: prize.id,
        prizeName: prize.name,
        rarity: prize.rarity,
        icon: prize.emoji
      }
      this.records.unshift(rec)
      const order = this.createRiskOrder({
        bizType: 'draw',
        recordId: rec.id,
        activityId: act.id,
        targetId: prize.id,
        targetName: prize.name,
        icon: prize.emoji,
        rarity: prize.rarity,
        cost,
        stockHeld: prize.rarity === 'none' ? 0 : 1,
        riskHits
      })
      rec.riskOrderId = order.id
      this.showToast('⚠️ 该次抽奖触发风控，奖品与积分已冻结，可在「风控申诉」中查看/申诉', 'warn')
      return rec
    },

    // ===== 任务 =====
    completeTask(taskId) {
      const t = this.tasks.find((x) => x.id === taskId)
      if (!t || t.claimed) return
      t.done = true
      this.claimTask(taskId)
    },
    claimTask(taskId) {
      const t = this.tasks.find((x) => x.id === taskId)
      if (!t || t.claimed || !t.done) return
      t.claimed = true
      this.points += t.reward
      this.addPointRecord(t.reward, `完成任务：${t.label}`, 'reward')
      this.showToast(`获得 ${t.reward} 积分`, 'success')
    },
    // 一键签到
    checkInTask() {
      this.completeTask('t-checkin')
    },

    // ===== 商城兑换 =====
    redeem(goodsId) {
      const g = this.goods.find((x) => x.id === goodsId)
      if (!g) return null
      if (g.remain <= 0) {
        this.showToast('商品已兑完', 'warn')
        return null
      }
      if (this.points < g.cost) {
        this.showToast('积分不足', 'warn')
        return null
      }

      // 风控评估（扣减前）
      const riskHits = this.evalRedeemRisk(g)
      if (riskHits.length) {
        return this.freezeRedeem(g, riskHits)
      }

      this.points -= g.cost
      g.remain -= 1
      this.addPointRecord(-g.cost, `兑换：${g.name}`)
      const rec = {
        id: genId('rg'),
        type: 'redeem',
        status: 'normal',
        date: this.todayDate,
        time: nowTime(),
        ts: Date.now(),
        goodsId: g.id,
        goodsName: g.name,
        icon: g.icon
      }
      this.records.unshift(rec)
      this.showToast(`兑换成功：${g.name}`, 'success')
      return rec
    },

    // 冻结兑换：占用积分 + 预占商品库存
    freezeRedeem(g, riskHits) {
      this.points -= g.cost
      g.remain -= 1
      g.frozen += 1
      this.addPointRecord(-g.cost, `冻结：兑换【${g.name}】待风控审核`, 'frozen')
      const rec = {
        id: genId('rg'),
        type: 'redeem',
        status: 'frozen',
        date: this.todayDate,
        time: nowTime(),
        ts: Date.now(),
        goodsId: g.id,
        goodsName: g.name,
        icon: g.icon
      }
      this.records.unshift(rec)
      const order = this.createRiskOrder({
        bizType: 'redeem',
        recordId: rec.id,
        targetId: g.id,
        targetName: g.name,
        icon: g.icon,
        cost: g.cost,
        stockHeld: 1,
        riskHits
      })
      rec.riskOrderId = order.id
      this.showToast('⚠️ 该笔兑换触发风控，积分与商品已冻结，可在「风控申诉」中查看/申诉', 'warn')
      return rec
    },

    // ===== 风控审核单 =====
    createRiskOrder({ bizType, recordId, activityId = null, targetId, targetName, icon, rarity = null, cost, stockHeld, riskHits }) {
      const order = {
        id: genId('rk'),
        bizType,                    // draw | redeem
        status: 'pending',          // pending | appealed | released | revoked
        userId: this.user.id,
        userName: this.user.name,
        recordId,
        activityId,
        targetId,
        targetName,
        icon,
        rarity,
        frozenPoints: cost || 0,    // 冻结的成本积分
        stockHeld,                  // 预占库存数量
        rules: riskHits.map((code) => ({ code, label: RULE_LABELS[code] || code })),
        appealReason: '',
        appealAt: '',
        reviewNote: '',
        reviewer: '',
        createdAt: this.todayDate,
        time: nowTime(),
        ts: Date.now(),
        reviewedAt: ''
      }
      this.riskOrders.unshift(order)
      this.addAuditLog('freeze', order.id,
        `${bizType === 'draw' ? '抽奖' : '兑换'}【${targetName}】命中规则：${order.rules.map((r) => r.label).join('、')}，冻结${cost || 0}积分${stockHeld ? `、预占库存×${stockHeld}` : ''}`)
      return order
    },

    // 用户申诉（仅本人、且单据处于待审核/已申诉可补充）
    appealRisk(orderId, reason) {
      const o = this.riskOrders.find((x) => x.id === orderId)
      if (!o) return false
      if (this.role === 'operator') {
        this.showToast('运营视角无需申诉，请切换到用户视角', 'warn')
        return false
      }
      if (o.userId !== this.user.id) {
        this.showToast('只能对自己的单据申诉', 'warn')
        return false
      }
      if (o.status !== 'pending' && o.status !== 'appealed') {
        this.showToast('该单据已处理，无法申诉', 'warn')
        return false
      }
      if (!reason || !reason.trim()) {
        this.showToast('请填写申诉理由', 'warn')
        return false
      }
      o.status = 'appealed'
      o.appealReason = reason.trim()
      o.appealAt = `${this.todayDate} ${nowTime()}`
      this.addAuditLog('appeal', o.id, `用户提交申诉：${o.appealReason}`)
      this.showToast('申诉已提交，等待运营审核', 'success')
      return true
    },

    // 运营放行（幂等：仅 pending/appealed 可处理）
    releaseRisk(orderId, note = '') {
      const o = this.riskOrders.find((x) => x.id === orderId)
      if (!o) return
      if (this.role !== 'operator') {
        this.showToast('仅运营可审核放行，请切换到运营视角', 'warn')
        return
      }
      if (o.status !== 'pending' && o.status !== 'appealed') {
        this.showToast('该单据已处理，请勿重复操作', 'warn')
        return
      }
      const rec = this.records.find((r) => r.id === o.recordId)
      if (!rec) {
        this.showToast('关联业务记录缺失，无法处理', 'warn')
        return
      }

      if (o.bizType === 'draw') {
        // 核销预占库存（remain 已扣，仅清 frozen）
        if (o.stockHeld) {
          const act = this.activities.find((a) => a.id === o.activityId)
          const prize = act?.prizes.find((p) => p.id === o.targetId)
          if (prize) prize.frozen = Math.max(0, prize.frozen - 1)
        }
        // 积分奖品此刻才入账
        const n = parseInt(o.targetName) || 0
        if (o.targetName.includes('积分') && n > 0) {
          this.points += n
          this.addPointRecord(n, `审核放行：抽奖奖品【${o.targetName}】`, 'release')
        }
      } else {
        const g = this.goods.find((x) => x.id === o.targetId)
        if (g) g.frozen = Math.max(0, g.frozen - 1)
      }

      o.status = 'released'
      o.reviewNote = note
      o.reviewer = this.user.name
      o.reviewedAt = `${this.todayDate} ${nowTime()}`
      rec.status = 'released'
      this.addAuditLog('release', o.id,
        `放行${o.bizType === 'draw' ? '抽奖' : '兑换'}【${o.targetName}】${note ? '；备注：' + note : ''}`)
      this.showToast(`已放行【${o.targetName}】`, 'success')
    },

    // 运营撤销：返还积分、回补库存、业务记录作废（幂等）
    revokeRisk(orderId, note = '') {
      const o = this.riskOrders.find((x) => x.id === orderId)
      if (!o) return
      if (this.role !== 'operator') {
        this.showToast('仅运营可审核撤销，请切换到运营视角', 'warn')
        return
      }
      if (o.status !== 'pending' && o.status !== 'appealed') {
        this.showToast('该单据已处理，请勿重复操作', 'warn')
        return
      }
      const rec = this.records.find((r) => r.id === o.recordId)
      if (!rec) {
        this.showToast('关联业务记录缺失，无法处理', 'warn')
        return
      }

      // 返还冻结的成本积分
      if (o.frozenPoints > 0) {
        this.points += o.frozenPoints
        this.addPointRecord(o.frozenPoints,
          `撤销返还：${o.bizType === 'draw' ? '抽奖' : '兑换'}【${o.targetName}】`, 'refund')
      }
      // 回补库存（remain 回补 + frozen 释放）
      if (o.bizType === 'draw') {
        if (o.stockHeld) {
          const act = this.activities.find((a) => a.id === o.activityId)
          const prize = act?.prizes.find((p) => p.id === o.targetId)
          if (prize) {
            prize.frozen = Math.max(0, prize.frozen - 1)
            prize.remain += 1
          }
        }
      } else {
        const g = this.goods.find((x) => x.id === o.targetId)
        if (g) {
          g.frozen = Math.max(0, g.frozen - 1)
          g.remain += 1
        }
      }

      o.status = 'revoked'
      o.reviewNote = note
      o.reviewer = this.user.name
      o.reviewedAt = `${this.todayDate} ${nowTime()}`
      rec.status = 'revoked'
      this.addAuditLog('revoke', o.id,
        `撤销${o.bizType === 'draw' ? '抽奖' : '兑换'}【${o.targetName}】，返还${o.frozenPoints}积分${o.stockHeld ? `、回补库存×${o.stockHeld}` : ''}${note ? '；备注：' + note : ''}`)
      this.showToast(`已撤销【${o.targetName}】，积分与库存已返还`, 'info')
    },

    // 更新风控规则（仅运营）
    updateRiskRules(patch) {
      if (this.role !== 'operator') {
        this.showToast('仅运营可配置风控规则', 'warn')
        return false
      }
      const before = this.riskRules
      this.riskRules = { ...this.riskRules, ...patch }
      const changes = []
      Object.keys(patch).forEach((k) => {
        if (JSON.stringify(before[k]) !== JSON.stringify(patch[k])) {
          changes.push(`${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(patch[k])}`)
        }
      })
      this.addAuditLog('config', null, changes.length ? `调整规则：${changes.join('；')}` : '规则配置已保存（无变化）')
      this.showToast('风控规则已更新', 'success')
      return true
    },

    saveDayLog() {
      // 占位：便于记录当天首次行为
      return true
    },

    // ===== 活动运营管理 =====
    toggleActivityStatus(id) {
      const a = this.activities.find((x) => x.id === id)
      if (!a) return
      const map = { running: 'paused', paused: 'running', ended: 'running' }
      a.status = map[a.status]
      this.showToast(`活动【${a.name}】已${a.status === 'running' ? '恢复/启动' : a.status === 'paused' ? '暂停' : '结束'}`, 'info')
    },
    resetActivityStock(id) {
      const a = this.activities.find((x) => x.id === id)
      if (!a) return
      // 重置时不动审核中预占的库存：remain 恢复为 总库存 - 冻结预占
      a.prizes.forEach((p) => { p.remain = p.stock - (p.frozen || 0) })
      this.showToast(`活动【${a.name}】奖品库存已恢复（风控预占保留）`, 'success')
    },
    createActivity(payload) {
      const id = 'act-' + Date.now().toString().slice(-5)
      const act = {
        id,
        name: payload.name,
        type: payload.type,
        status: 'running',
        cost: payload.cost || 0,
        costType: payload.costType || 'free',
        dailyLimit: payload.dailyLimit || 3,
        totalLimit: payload.totalLimit || 50,
        icon: '🎪',
        desc: payload.desc || '新活动',
        startAt: payload.startAt || this.todayDate,
        endAt: payload.endAt || this.todayDate,
        prizes: (payload.prizes || []).map((p, i) => ({
          id: 'p' + i + '-' + id,
          name: p.name,
          rarity: p.rarity || 'common',
          stock: p.stock || 10,
          remain: p.stock || 10,
          frozen: 0,
          weight: p.weight || 10,
          emoji: p.emoji || '🎁'
        }))
      }
      // 确保含"谢谢参与"
      if (!act.prizes.some((p) => p.rarity === 'none')) {
        act.prizes.push({ id: 'p-none-' + id, name: '谢谢参与', rarity: 'none', stock: 99999, remain: 99999, frozen: 0, weight: 100, emoji: '🤝' })
      }
      this.activities.unshift(act)
      this.showToast(`活动【${act.name}】创建成功`, 'success')
      return act
    },

    // ===== 演示数据：预置审核单 / 冻结积分 / 预占库存 =====
    seedRiskData() {
      const uid = this.user.id
      const uname = this.user.name
      // —— 1) 待审核：传说大奖（10 积分成本 + 预占 iPhone） ——
      const a1 = this.activities.find((a) => a.id === 'act-1')
      const pLegend = a1?.prizes.find((p) => p.id === 'p1')
      if (pLegend) { pLegend.remain -= 1; pLegend.frozen += 1 }
      const rec1 = {
        id: 'seed-r1', type: 'draw', status: 'frozen',
        date: this.todayDate, time: '10:02:15', ts: todayAt(10, 2),
        activityId: 'act-1', activityName: '周年庆幸运转盘',
        prizeId: 'p1', prizeName: 'iPhone 16', rarity: 'legendary', icon: '📱',
        riskOrderId: 'seed-rk1'
      }
      this.records.push(rec1)
      this.riskOrders.push({
        id: 'seed-rk1', bizType: 'draw', status: 'pending', userId: uid, userName: uname,
        recordId: rec1.id, activityId: 'act-1', targetId: 'p1', targetName: 'iPhone 16',
        icon: '📱', rarity: 'legendary', frozenPoints: 0, stockHeld: 1,
        rules: [{ code: 'highValue', label: RULE_LABELS.highValue }],
        appealReason: '', appealAt: '', reviewNote: '', reviewer: '',
        createdAt: this.todayDate, time: '10:02:15', ts: todayAt(10, 2), reviewedAt: ''
      })

      // —— 2) 已申诉：刮刮乐史诗（10 积分成本冻结 + 预占视频月卡） ——
      const a2 = this.activities.find((a) => a.id === 'act-2')
      const pEpic = a2?.prizes.find((p) => p.id === 'p2')
      if (pEpic) { pEpic.remain -= 1; pEpic.frozen += 1 }
      this.points -= 10
      const rec2 = {
        id: 'seed-r2', type: 'draw', status: 'frozen',
        date: this.todayDate, time: '09:40:08', ts: todayAt(9, 40),
        activityId: 'act-2', activityName: '新人刮刮乐',
        prizeId: 'p2', prizeName: '视频月卡', rarity: 'epic', icon: '🎬',
        riskOrderId: 'seed-rk2'
      }
      this.records.push(rec2)
      this.riskOrders.push({
        id: 'seed-rk2', bizType: 'draw', status: 'appealed', userId: uid, userName: uname,
        recordId: rec2.id, activityId: 'act-2', targetId: 'p2', targetName: '视频月卡',
        icon: '🎬', rarity: 'epic', frozenPoints: 10, stockHeld: 1,
        rules: [{ code: 'highValue', label: RULE_LABELS.highValue }],
        appealReason: '本人正常参与活动中奖，未使用任何外挂，请求放行。',
        appealAt: `${this.todayDate} 09:45:30`, reviewNote: '', reviewer: '',
        createdAt: this.todayDate, time: '09:40:08', ts: todayAt(9, 40), reviewedAt: ''
      })
      this.pointRecords.unshift({
        id: 'seed-pr2', date: this.todayDate, time: '09:40:08', ts: todayAt(9, 40),
        delta: -10, balance: this.points, note: '冻结：参与【新人刮刮乐】待风控审核', kind: 'frozen'
      })

      // —— 3) 待审核：高价值兑换 盲盒福袋（200 积分冻结 + 预占 g4） ——
      const g4 = this.goods.find((g) => g.id === 'g4')
      if (g4) { g4.remain -= 1; g4.frozen += 1 }
      this.points -= 200
      const rec3 = {
        id: 'seed-r3', type: 'redeem', status: 'frozen',
        date: this.todayDate, time: '09:15:22', ts: todayAt(9, 15),
        goodsId: 'g4', goodsName: '盲盒福袋', icon: '🎁', riskOrderId: 'seed-rk3'
      }
      this.records.push(rec3)
      this.riskOrders.push({
        id: 'seed-rk3', bizType: 'redeem', status: 'pending', userId: uid, userName: uname,
        recordId: rec3.id, activityId: null, targetId: 'g4', targetName: '盲盒福袋',
        icon: '🎁', rarity: null, frozenPoints: 200, stockHeld: 1,
        rules: [{ code: 'highValue', label: RULE_LABELS.highValue },
                { code: 'rapidRedeem', label: RULE_LABELS.rapidRedeem }],
        appealReason: '', appealAt: '', reviewNote: '', reviewer: '',
        createdAt: this.todayDate, time: '09:15:22', ts: todayAt(9, 15), reviewedAt: ''
      })
      this.pointRecords.unshift({
        id: 'seed-pr3', date: this.todayDate, time: '09:15:22', ts: todayAt(9, 15),
        delta: -200, balance: this.points, note: '冻结：兑换【盲盒福袋】待风控审核', kind: 'frozen'
      })

      // —— 4) 已放行：500元购物卡（免费转盘，无积分冻结，库存已核销） ——
      const pEpicCard = a1?.prizes.find((p) => p.id === 'p2')
      if (pEpicCard) { pEpicCard.remain -= 1 }
      const rec4 = {
        id: 'seed-r4', type: 'draw', status: 'released',
        date: this.todayDate, time: '08:55:40', ts: todayAt(8, 55),
        activityId: 'act-1', activityName: '周年庆幸运转盘',
        prizeId: 'p2', prizeName: '500元购物卡', rarity: 'epic', icon: '💳',
        riskOrderId: 'seed-rk4'
      }
      this.records.push(rec4)
      this.riskOrders.push({
        id: 'seed-rk4', bizType: 'draw', status: 'released', userId: uid, userName: uname,
        recordId: rec4.id, activityId: 'act-1', targetId: 'p2', targetName: '500元购物卡',
        icon: '💳', rarity: 'epic', frozenPoints: 0, stockHeld: 0,
        rules: [{ code: 'highValue', label: RULE_LABELS.highValue }],
        appealReason: '系统误判，正常中奖。', appealAt: `${this.todayDate} 09:00:00`,
        reviewNote: '核实为正常用户，放行并发奖。', reviewer: '运营小张',
        createdAt: this.todayDate, time: '08:55:40', ts: todayAt(8, 55),
        reviewedAt: `${this.todayDate} 09:10:12`
      })

      // —— 5) 已撤销：视频会员周卡（80 积分已返还 + 库存已回补，故不动现库存） ——
      const rec5 = {
        id: 'seed-r5', type: 'redeem', status: 'revoked',
        date: this.todayDate, time: '08:30:05', ts: todayAt(8, 30),
        goodsId: 'g2', goodsName: '视频会员周卡', icon: '🎬', riskOrderId: 'seed-rk5'
      }
      this.records.push(rec5)
      this.riskOrders.push({
        id: 'seed-rk5', bizType: 'redeem', status: 'revoked', userId: uid, userName: uname,
        recordId: rec5.id, activityId: null, targetId: 'g2', targetName: '视频会员周卡',
        icon: '🎬', rarity: null, frozenPoints: 80, stockHeld: 0,
        rules: [{ code: 'rapidRedeem', label: RULE_LABELS.rapidRedeem }],
        appealReason: '', appealAt: '',
        reviewNote: '命中短时连续兑换规则，自动拦截，用户未申诉。', reviewer: '系统',
        createdAt: this.todayDate, time: '08:30:05', ts: todayAt(8, 30),
        reviewedAt: `${this.todayDate} 08:35:00`
      })
      this.pointRecords.unshift({
        id: 'seed-pr5', date: this.todayDate, time: '08:35:00', ts: todayAt(8, 35),
        delta: 80, balance: this.points, note: '撤销返还：兑换【视频会员周卡】', kind: 'refund'
      })

      // 初始可用积分：260（此前已 -10/-200 冻结、+80 返还在重放中记账）→ 起点补 470
      this.points += 470
      // 修正流水余额快照（append-only，重排后顺序写入当时余额）
      this.rebalanceSeedPoints()

      // 审计日志（最新在前）
      this.auditLogs = [
        { id: 'seed-log5', action: 'revoke', actionLabel: '审核撤销', orderId: 'seed-rk5', operator: '系统', detail: '撤销兑换【视频会员周卡】，返还80积分、回补库存×1；备注：命中短时连续兑换规则，自动拦截，用户未申诉。', date: this.todayDate, time: '08:35:00' },
        { id: 'seed-log4', action: 'release', actionLabel: '审核放行', orderId: 'seed-rk4', operator: '运营小张', detail: '放行抽奖【500元购物卡】；备注：核实为正常用户，放行并发奖。', date: this.todayDate, time: '09:10:12' },
        { id: 'seed-log3', action: 'appeal', actionLabel: '用户申诉', orderId: 'seed-rk2', operator: uname, detail: '用户提交申诉：本人正常参与活动中奖，未使用任何外挂，请求放行。', date: this.todayDate, time: '09:45:30' },
        { id: 'seed-log2', action: 'freeze', actionLabel: '风控冻结', orderId: 'seed-rk3', operator: uname, detail: '兑换【盲盒福袋】命中规则：高价值奖品/兑换、短时间连续兑换，冻结200积分、预占库存×1', date: this.todayDate, time: '09:15:22' },
        { id: 'seed-log1', action: 'freeze', actionLabel: '风控冻结', orderId: 'seed-rk1', operator: uname, detail: '抽奖【iPhone 16】命中规则：高价值奖品/兑换，冻结0积分、预占库存×1', date: this.todayDate, time: '10:02:15' }
      ]
    },

    // 按时间正序重放种子流水，修正每行 balance 快照
    rebalanceSeedPoints() {
      const seeds = this.pointRecords.filter((p) => p.id.startsWith('seed-'))
      if (!seeds.length) return
      const sorted = [...seeds].sort((a, b) => a.ts - b.ts)
      let bal = this.points - sorted.reduce((s, p) => s + p.delta, 0)
      sorted.forEach((p) => {
        bal += p.delta
        p.balance = bal
      })
    }
  }
})
