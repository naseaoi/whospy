export interface WordPair {
  civilian: string;
  spy: string;
  category: string;
}

export const WORD_LIBRARY: WordPair[] = [
  { civilian: "牛肉干", spy: "猪肉脯", category: "食物" },
  { civilian: "微信", spy: "QQ", category: "应用" },
  { civilian: "成吉思汗", spy: "努尔哈赤", category: "历史人物" },
  { civilian: "自行车", spy: "电动车", category: "交通工具" },
  { civilian: "麦当劳", spy: "肯德基", category: "品牌" },
  { civilian: "蜘蛛侠", spy: "蝙蝠侠", category: "英雄" },
  { civilian: "牛奶", spy: "豆浆", category: "饮品" },
  { civilian: "包子", spy: "饺子", category: "食物" },
  { civilian: "保安", spy: "保镖", category: "职业" },
  { civilian: "吉他", spy: "琵琶", category: "乐器" }
];

export function getRandomWord(): WordPair {
  return WORD_LIBRARY[Math.floor(Math.random() * WORD_LIBRARY.length)];
}
