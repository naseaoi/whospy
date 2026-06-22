# ConfirmDialog 使用示例

可复用的确认对话框组件，用于替代浏览器原生的 `confirm()`。

## 基本用法

```tsx
import { ConfirmDialog } from '../components/ConfirmDialog';

function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button onClick={() => setShowConfirm(true)}>
        危险操作
      </button>

      <ConfirmDialog
        isOpen={showConfirm}
        title="确认操作"
        message="确定要执行此操作吗？"
        confirmText="确定"
        cancelText="取消"
        type="warning"
        onConfirm={() => {
          setShowConfirm(false);
          // 执行确认操作
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
```

## 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| isOpen | boolean | - | 是否显示对话框 |
| title | string | - | 对话框标题 |
| message | string \| ReactNode | - | 对话框内容 |
| confirmText | string | "确定" | 确认按钮文本 |
| cancelText | string | "取消" | 取消按钮文本 |
| type | 'danger' \| 'warning' \| 'info' | 'warning' | 对话框类型，影响图标和颜色 |
| onConfirm | () => void | - | 点击确认按钮的回调 |
| onCancel | () => void | - | 点击取消按钮的回调 |

## 类型说明

### danger（危险）
- 图标：⚠️（红色）
- 用于：删除数据、不可逆操作

### warning（警告）
- 图标：❓（黄色）
- 用于：退出、放弃修改

### info（信息）
- 图标：ℹ️（蓝色）
- 用于：一般提示确认

## 示例场景

### 1. 退出房间
```tsx
<ConfirmDialog
  isOpen={showLeaveConfirm}
  title="退出房间"
  message="确定要退出房间吗？"
  confirmText="确定退出"
  cancelText="取消"
  type="warning"
  onConfirm={() => {
    setShowLeaveConfirm(false);
    leaveRoom();
  }}
  onCancel={() => setShowLeaveConfirm(false)}
/>
```

### 2. 删除数据
```tsx
<ConfirmDialog
  isOpen={showDeleteConfirm}
  title="删除确认"
  message="删除后无法恢复，确定要删除吗？"
  confirmText="确定删除"
  cancelText="取消"
  type="danger"
  onConfirm={() => {
    setShowDeleteConfirm(false);
    deleteItem();
  }}
  onCancel={() => setShowDeleteConfirm(false)}
/>
```

### 3. 自定义内容
```tsx
<ConfirmDialog
  isOpen={showCustomConfirm}
  title="确认提交"
  message={
    <div>
      <p>即将提交以下内容：</p>
      <ul>
        <li>选项A</li>
        <li>选项B</li>
      </ul>
    </div>
  }
  type="info"
  onConfirm={() => {
    setShowCustomConfirm(false);
    submitForm();
  }}
  onCancel={() => setShowCustomConfirm(false)}
/>
```
