module.exports = app => ({
  async find () {
    const { ctx, $helper } = app;
    ctx.body = $helper.Result.success('base controller response！')
  },
})
