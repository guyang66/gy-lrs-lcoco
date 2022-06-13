module.exports = app => ({
  async test () {
    const { ctx, $helper } = app;
    ctx.body = $helper.Result.success('common controller response！')
  }
})
