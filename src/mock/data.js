// 奖品稀有度与外观配置
export const PRIZE_RARITY = {
  legendary: { label: '传说', color: '#ff5252', icon: '💎' },
  epic: { label: '史诗', color: '#ab47bc', icon: '🏆' },
  rare: { label: '稀有', color: '#42a5f5', icon: '🎁' },
  common: { label: '普通', color: '#78909c', icon: '🎈' },
  none: { label: '谢谢参与', color: '#9e9e9e', icon: '🤝' }
}

// 抽奖玩法类型
export const GAME_TYPES = {
  wheel: { label: '幸运转盘', desc: '指针旋转抽奖' },
  scratch: { label: '刮刮乐', desc: '刮开涂层揭晓' }
}

// 风控默认规则（运营可在「风控审核」中配置）
export const DEFAULT_RISK_RULES = {
  enabled: true,              // 风控总开关
  highValueRarities: ['legendary', 'epic'], // 命中即冻结的高价值奖品
  dailyDrawThreshold: 4,      // 当日抽奖次数达到该值即视为高频
  rapidDrawSeconds: 30,       // 抽奖短时窗口（秒）
  rapidDrawMax: 3,            // 窗口内抽奖次数达到该值即冻结
  rapidRedeemSeconds: 60,     // 兑换短时窗口（秒）
  rapidRedeemMax: 2,          // 窗口内兑换次数达到该值即冻结
  highValueRedeemCost: 150,   // 单笔兑换积分达到该值视为高价值
  blacklist: []               // 用户黑名单（用户 id，逗号分隔维护）
}

// 预置活动
export const ACTIVITIES = [
  {
    id: 'act-1',
    name: '周年庆幸运转盘',
    type: 'wheel',
    status: 'running',
    cost: 0,                 // 免费抽
    dailyLimit: 3,           // 每日限抽
    totalLimit: 20,          // 每人总限抽
    costType: 'free',
    icon: '🎡',
    desc: '周年庆回馈老用户，转盘好礼送不停',
    startAt: '2026-09-01',
    endAt: '2026-10-01',
    prizes: [
      { id: 'p1', name: 'iPhone 16', rarity: 'legendary', stock: 3, remain: 3, weight: 1, emoji: '📱' },
      { id: 'p2', name: '500元购物卡', rarity: 'epic', stock: 20, remain: 20, weight: 4, emoji: '💳' },
      { id: 'p3', name: '定制保温杯', rarity: 'rare', stock: 150, remain: 150, weight: 15, emoji: '☕' },
      { id: 'p4', name: '30积分', rarity: 'rare', stock: 500, remain: 500, weight: 30, emoji: '🪙' },
      { id: 'p5', name: '5积分', rarity: 'common', stock: 2000, remain: 2000, weight: 50, emoji: '✨' },
      { id: 'p6', name: '谢谢参与', rarity: 'none', stock: 99999, remain: 99999, weight: 100, emoji: '🤝' }
    ]
  },
  {
    id: 'act-2',
    name: '新人刮刮乐',
    type: 'scratch',
    status: 'running',
    cost: 10,                // 积分消耗
    dailyLimit: 5,
    totalLimit: 50,
    costType: 'points',
    icon: '🎰',
    desc: '新用户专区，消耗积分刮取惊喜',
    startAt: '2026-09-10',
    endAt: '2026-09-30',
    prizes: [
      { id: 'p1', name: '蓝牙耳机', rarity: 'legendary', stock: 5, remain: 5, weight: 1, emoji: '🎧' },
      { id: 'p2', name: '视频月卡', rarity: 'epic', stock: 50, remain: 50, weight: 6, emoji: '🎬' },
      { id: 'p3', name: '20积分', rarity: 'rare', stock: 400, remain: 400, weight: 25, emoji: '🪙' },
      { id: 'p4', name: '5积分', rarity: 'common', stock: 800, remain: 800, weight: 50, emoji: '✨' },
      { id: 'p5', name: '谢谢参与', rarity: 'none', stock: 99999, remain: 99999, weight: 100, emoji: '🤝' }
    ]
  }
]

// 预设任务（积分来源）
export const TASKS = [
  { id: 't-checkin', label: '每日签到', reward: 5, icon: '📅', type: 'daily' },
  { id: 't-watch', label: '观看今日视频', reward: 10, icon: '▶️', type: 'daily' },
  { id: 't-share', label: '分享活动', reward: 8, icon: '📣', type: 'daily' },
  { id: 't-draw3', label: '今日抽奖3次', reward: 15, icon: '🎲', type: 'daily' },
  { id: 't-bind', label: '完善个人信息', reward: 30, icon: '👤', type: 'once' },
  { id: 't-invite', label: '邀请好友注册', reward: 50, icon: '🤝', type: 'once' }
]

// 积分商城兑换商品
export const SHOP_GOODS = [
  { id: 'g1', name: '满50减10优惠券', cost: 30, icon: '🎟️', stock: 200, remain: 200 },
  { id: 'g2', name: '视频会员周卡', cost: 80, icon: '🎬', stock: 100, remain: 100 },
  { id: 'g3', name: '定制帆布袋', cost: 150, icon: '👜', stock: 50, remain: 50 },
  { id: 'g4', name: '盲盒福袋', cost: 200, icon: '🎁', stock: 30, remain: 30 },
  { id: 'g5', name: '与牛人共进午餐', cost: 500, icon: '🍽️', stock: 5, remain: 5 }
]

export const DEMO_USER = {
  id: 'u-1001',
  name: '运营测试用户',
  avatar: '🦊'
}