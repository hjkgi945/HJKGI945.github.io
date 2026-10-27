/* =========================================================
   游戏数据
   ---------------------------------------------------------
   想新增一款游戏？复制下面任意一条对象，改改内容即可。
   字段说明：
     id        唯一标识，不要和别人重复
     title     中文名
     titleEn   英文名（显示在卡片副标题）
     category  主分类，会自动变成筛选按钮
     tags      标签数组，搜索时也会匹配
     rating    评分 0–10
     year      发行年份
     platforms 平台
     emoji     封面大图标（暂时不用真图，先用 emoji 顶着）
     colors    封面渐变色 [起始色, 结束色]
     desc      详情介绍
   ========================================================= */

const GAMES = [
  {
    id: 'lol',
    title: '英雄联盟',
    titleEn: 'League of Legends',
    category: '竞技',
    tags: ['MOBA', '团队', '电竞'],
    rating: 9.2,
    year: 2009,
    platforms: 'PC',
    emoji: '🛡️',
    colors: ['#0a323c', '#c8aa6e'],
    desc: '五人一队的经典 MOBA，一百多位英雄、上百种出装思路。上手不难，但想玩明白，得花上几百个小时。适合喜欢和人斗智斗勇的玩家。'
  },
  {
    id: 'genshin',
    title: '原神',
    titleEn: 'Genshin Impact',
    category: '开放世界',
    tags: ['二次元', '探索', '抽卡'],
    rating: 9.0,
    year: 2020,
    platforms: 'PC / 手机 / PS',
    emoji: '🌏',
    colors: ['#1b4b6b', '#7ed6c8'],
    desc: '在提瓦特大陆上攀爬、滑翔、解谜，顺手收集一堆角色。元素反应系统让战斗有了搭配的乐趣，美术和音乐是它的招牌。'
  },
  {
    id: 'minecraft',
    title: '我的世界',
    titleEn: 'Minecraft',
    category: '沙盒',
    tags: ['建造', '生存', '联机'],
    rating: 9.5,
    year: 2011,
    platforms: '全平台',
    emoji: '⛏️',
    colors: ['#2f5d33', '#8fce6b'],
    desc: '一个由方块组成的世界。白天砍树挖矿，晚上躲僵尸，玩久了就开始造城堡、修铁路、写红石电路。几乎没有它做不到的事。'
  },
  {
    id: 'eldenring',
    title: '艾尔登法环',
    titleEn: 'Elden Ring',
    category: '角色扮演',
    tags: ['魂系', '高难度', '开放世界'],
    rating: 9.6,
    year: 2022,
    platforms: 'PC / 主机',
    emoji: '⚔️',
    colors: ['#3a2a12', '#d4af37'],
    desc: '宫崎英高与乔治·R·R·马丁合作的作品。地图大得惊人，但每个角落都藏着惊喜或杀机。死很多次是正常的，打赢 Boss 的那一刻也是真的爽。'
  },
  {
    id: 'zelda-totk',
    title: '塞尔达传说：王国之泪',
    titleEn: 'Tears of the Kingdom',
    category: '开放世界',
    tags: ['解谜', '冒险', '自由度'],
    rating: 9.7,
    year: 2023,
    platforms: 'Switch',
    emoji: '🗡️',
    colors: ['#2b4a2f', '#c9d96b'],
    desc: '究极自由的海拉鲁。可以造车、造船、造飞机，也能把敌人绑在火箭上送上天。它教会很多玩家一件事：解法不止一种。'
  },
  {
    id: 'stardew',
    title: '星露谷物语',
    titleEn: 'Stardew Valley',
    category: '休闲',
    tags: ['种田', '治愈', '经营'],
    rating: 9.4,
    year: 2016,
    platforms: 'PC / 主机 / 手机',
    emoji: '🌾',
    colors: ['#4a3a1a', '#e0b96a'],
    desc: '继承爷爷的农场，种地、钓鱼、下矿、和镇上的人交朋友。节奏很慢，但一天一天过下去，很容易就玩到凌晨三点。'
  },
  {
    id: 'hollowknight',
    title: '空洞骑士',
    titleEn: 'Hollow Knight',
    category: '独立',
    tags: ['类银河恶魔城', '手绘', '挑战'],
    rating: 9.3,
    year: 2017,
    platforms: 'PC / 主机',
    emoji: '🐞',
    colors: ['#13202e', '#6fb3c9'],
    desc: '手绘风格的虫子王国。地图要自己画，路要自己找，Boss 要自己死磕。安静、忧伤，又美得让人舍不得放下。'
  },
  {
    id: 'terraria',
    title: '泰拉瑞亚',
    titleEn: 'Terraria',
    category: '沙盒',
    tags: ['2D', '建造', '冒险'],
    rating: 9.2,
    year: 2011,
    platforms: 'PC / 主机 / 手机',
    emoji: '🌳',
    colors: ['#1f4a3d', '#79c48c'],
    desc: '横版的沙盒冒险，挖矿、造房子、打 Boss、刷装备。内容量大得离谱，一个存档能玩上百小时，价格却一直很便宜。'
  },
  {
    id: 'valorant',
    title: '无畏契约',
    titleEn: 'VALORANT',
    category: '射击',
    tags: ['战术', '竞技', 'FPS'],
    rating: 8.8,
    year: 2020,
    platforms: 'PC',
    emoji: '🎯',
    colors: ['#3a1620', '#ff5c72'],
    desc: '五对五的战术射击，枪法重要，技能配合更重要。每回合的经济和站位都需要盘算，适合喜欢竞技和开黑的玩家。'
  },
  {
    id: 'naraka',
    title: '永劫无间',
    titleEn: 'Naraka: Bladepoint',
    category: '动作',
    tags: ['武侠', '吃鸡', '近战'],
    rating: 8.5,
    year: 2021,
    platforms: 'PC / 主机',
    emoji: '🥷',
    colors: ['#1c2b3a', '#c94f4f'],
    desc: '用钩锁在屋顶间飞，用刀剑和长枪贴身对拼。武侠味的近战吃鸡，操作上限很高，打赢一场能回味很久。'
  },
  {
    id: 'wukong',
    title: '黑神话：悟空',
    titleEn: 'Black Myth: Wukong',
    category: '动作',
    tags: ['西游', '单机', '国产'],
    rating: 9.1,
    year: 2024,
    platforms: 'PC / PS5',
    emoji: '🐒',
    colors: ['#2a1d12', '#e08a3c'],
    desc: '以《西游记》为底子的动作游戏。棍法、变身、法术组合起来打妖怪，场景里的寺庙和雕像细节相当讲究。'
  },
  {
    id: 'ittakestwo',
    title: '双人成行',
    titleEn: 'It Takes Two',
    category: '合作',
    tags: ['双人', '解谜', '剧情'],
    rating: 9.5,
    year: 2021,
    platforms: '全平台',
    emoji: '🤝',
    colors: ['#3d1f4a', '#ff8fb1'],
    desc: '必须两个人一起玩的游戏，而且每一关都会换一套玩法。适合拉上朋友或对象，一个周末通关，笑料不断。'
  },
  {
    id: 'civ6',
    title: '文明 VI',
    titleEn: 'Civilization VI',
    category: '策略',
    tags: ['回合制', '4X', '历史'],
    rating: 9.0,
    year: 2016,
    platforms: 'PC / 主机 / 手机',
    emoji: '🏛️',
    colors: ['#1d2a44', '#d9c27a'],
    desc: '从石器时代一路发展到太空时代。嘴上说「再来一回合就睡」，抬头已经天亮了。策略游戏里的经典时间黑洞。'
  },
  {
    id: 'hearthstone',
    title: '炉石传说',
    titleEn: 'Hearthstone',
    category: '策略',
    tags: ['卡牌', '休闲', '对战'],
    rating: 8.4,
    year: 2014,
    platforms: 'PC / 手机',
    emoji: '🃏',
    colors: ['#3a2412', '#e6b45c'],
    desc: '规则简单、对局飞快的一款卡牌游戏。组一套卡组，跟对手你来我往，偶尔被一张神抽翻盘，也算是一种浪漫。'
  },
  {
    id: 'overwatch2',
    title: '守望先锋 2',
    titleEn: 'Overwatch 2',
    category: '射击',
    tags: ['英雄', '团队', 'FPS'],
    rating: 8.2,
    year: 2022,
    platforms: '全平台',
    emoji: '🚀',
    colors: ['#1b2b4a', '#f5a623'],
    desc: '每个英雄都有独特的技能和定位，坦克、输出、辅助互相配合。节奏快、团战爽，适合喜欢团队协作的玩家。'
  },
  {
    id: 'acnh',
    title: '集合啦！动物森友会',
    titleEn: 'Animal Crossing: New Horizons',
    category: '休闲',
    tags: ['社交', '治愈', '建设'],
    rating: 9.1,
    year: 2020,
    platforms: 'Switch',
    emoji: '🏝️',
    colors: ['#1f5a5a', '#9ee6c8'],
    desc: '在一座无人岛上慢慢生活：钓鱼、捉虫、种花、布置家具，和邻居聊天。没有 deadline，也没有输赢，随时可以放下。'
  }
];
