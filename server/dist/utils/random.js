"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAMES = exports.AVATARS = void 0;
exports.generateRandomName = generateRandomName;
exports.generateRandomAvatar = generateRandomAvatar;
exports.AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];
exports.NAMES = [
    "快乐的薯条", "悲伤的汉堡", "暴躁的各种", "冷酷的杀手", "迷茫的咸鱼",
    "进击的巨人", "只会喊666", "专业配角", "摸鱼达人", "熬夜冠军",
    "甚至不想起名", "路人甲", "不明生物", "外星人", "潜水员"
];
function generateRandomName() {
    return exports.NAMES[Math.floor(Math.random() * exports.NAMES.length)];
}
function generateRandomAvatar() {
    return exports.AVATARS[Math.floor(Math.random() * exports.AVATARS.length)];
}
