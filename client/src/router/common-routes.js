import Welcome from "@pages/views/welcome";

// 公共路由要喝菜单匹配上
const publicRoutes = [
  {
    path: '/admin/index',
    name: '首页',
    key: 'index',
    exact: true,
    component: Welcome,
  },
];

export default publicRoutes;
