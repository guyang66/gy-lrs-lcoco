module.exports = app => ({
  async find () {
    const { ctx, $helper } = app;
    ctx.body = $helper.Result.success('base controller response！')
  },

  /**
   * 创建用户
   * @returns {Promise<void>}
   */
  async createUser () {

  }
})
