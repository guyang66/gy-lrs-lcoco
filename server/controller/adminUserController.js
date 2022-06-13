module.exports = app => ({

  /**
   * 创建用户
   * @returns {Promise<void>}
   */
  async createUser() {
    const { ctx, $service, $helper, $model } = app
    const { user } = $model
    const { username } = ctx.query
    if(!username || username === ''){
      ctx.body = 'username为空！'
      return
    }

    let existUser = await $service.baseService.findOne(user, {username: username})
    if(existUser){
      ctx.body = $helper.Result.fail('-1', '当前用户已存在！')
      return
    }

    let pass = await $helper.createPassword('123456')
    let r = await $service.userService.createUser(username, pass)
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '创建用户失败！')
    }
  },

  /**
   * 删除用户
   * @returns {Promise<void>}
   */
  async deleteUser () {
    const { ctx, $service, $helper, $model } = app
    const { user } = $model
    const { id } = ctx.query
    if(!id){
      ctx.body = $helper.Result.fail(-1, '参数缺失（id不存在）！')
      return
    }
    let result = await $service.baseService.delete(id, user)
    if(result){
      ctx.body = $helper.Result.success(result)
    } else {
      ctx.body = $helper.Result.fail(-1, '删除失败！')
    }
  },

  /**
   * 通过token获取用户信息
   * @returns {Promise<void>}
   */

  async getUserInfo () {
    const { ctx, $service, $helper } = app
    const token = ctx.header.authorization
    let user;
    try {
      user = await $helper.decodeToken(token)
    } catch (e) {
      $helper.Result.fail(-1,e)
    }
    if(!user){
      $helper.Result.fail(-1, '用户信息不存在')
    }
    let realUser = await $service.userService.getUserInfoById(user._id)
    ctx.userInfo = realUser
    ctx.body = $helper.Result.success(realUser)
  },

  /**
   * 更新用户信息
   * @returns {Promise<void>}
   */
  async updateUserInfo () {
    const { ctx, $service, $helper, $model } = app
    const { user, role } = $model
    const { content, id } = ctx.request.body
    if(!id){
      ctx.body = $helper.Result.fail(-1,'参数有误（id不存在）！')
      return
    }

    let dingNumber = content.dingNumber
    if(dingNumber !== null && dingNumber !== undefined){
      dingNumber = content.dingNumber - 0
      if(!dingNumber || isNaN(content.dingNumber) || dingNumber <= 0){
        ctx.body = $helper.Result.fail(-1,'工号格式错误或不存在！')
        return
      }
    }

    // 处理默认角色name

    let roles = await $service.baseService.query(role, {status: 1}) || []
    if(content.roles && content.roles.length > 0){
      let currentUser = await $service.baseService.queryById(id, user)
      let roleInstance = content.roles.find( item =>{
        return item === currentUser.defaultRole
      })
      if(!roleInstance) {
        content.defaultRole = content.roles[0]
        content.defaultRoleName = roles.find(role=>{
          return role.key === content.defaultRole
        }).name
      }
    }

    let r = await $service.baseService.update(id, content, user)
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '操作失败！')
    }
  },

  /**
   * 获取所有用户
   * @returns {Promise<void>}
   */
  async getUserList () {
    const { ctx, $service, $helper } = app
    let { page, pageSize, searchKey, status } = ctx.request.body
    if(!page || page <= 0) {
      page = 1
    }
    if(!pageSize || pageSize < 0 ){
      pageSize = 10
    }
    let r = await $service.userService.getList(page, pageSize, {searchKey, status})
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 修改密码
   * @returns {Promise<void>}
   */
  async updatePassword () {
    const { ctx, $service, $model, $helper } = app
    const { user } = $model
    let { password, verifyCode } = ctx.request.body
    let code =  ctx.session.captcha
    if(!password || password === ''){
      ctx.body = $helper.Result.fail(-1,'密码不能设置为空！')
      return
    }

    if(!verifyCode || verifyCode === '' || verifyCode.length !== 4){
      ctx.body = $helper.Result.fail(-1,'验证码格式有误！')
      return
    }

    if(verifyCode.toLowerCase() !== code){
      ctx.body = $helper.Result.fail(-1,'验证码错误！')
      return
    }
    const token = ctx.header.authorization
    let userInfo;
    try {
      userInfo = await $helper.decodeToken(token)
    } catch (e) {
      $helper.Result.fail(-1,e)
    }
    if(!userInfo){
      $helper.Result.fail(-1, '用户信息不存在或者用户未登录')
    }

    let pass = await $helper.createPassword(password.toString())
    let r = await $service.baseService.update(userInfo._id, {password: pass}, user)
    if(r){
      ctx.body = $helper.Result.success('ok')
    } else {
      ctx.body = $helper.Result.fail(-1, 'fail')
    }
  }
})
