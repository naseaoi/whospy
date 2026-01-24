export const AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];
export const NAMES = [
  "快乐的薯条", "悲伤的汉堡", "暴躁的各种", "冷酷的杀手", "迷茫的咸鱼",
  "进击的巨人", "只会喊666", "专业配角", "摸鱼达人", "熬夜冠军",
  "甚至不想起名", "路人甲", "不明生物", "外星人", "潜水员"
];

export function generateRandomName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export function generateRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}
