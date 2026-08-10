# MomoBlog 前端

Vue 3 + Vant 4 + Pinia + Vue Router

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

输出到 `dist/`，部署到 Nginx。

## 目录结构

```
src/
├── api/          # API 请求
├── components/   # 组件
├── composables/  # 组合式函数
├── plugins/      # 插件
├── router/       # 路由
├── stores/       # Pinia 状态
├── styles/       # 样式
├── utils/        # 工具函数
└── views/        # 页面
```

## 环境变量

`.env.production`：

```
VITE_API_URL=https://yourdomain.com/api
```

## License

MIT
