module.exports = app => ({

  /**
   * 创建用户
   * @returns {Promise<void>}
   */
  async createUser() {
    const { ctx, $service, $helper, $model } = app
    const { user } = $model
    const { username, name, password, role } = ctx.request.body
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    if(!name || name === ''){
      ctx.body = $helper.Result.fail(-1,'name不能为空！')
      return
    }
    if(!password || password === ''){
      ctx.body = $helper.Result.fail(-1,'password不能为空！')
      return
    }
    if(!role || role === ''){
      ctx.body = $helper.Result.fail(-1,'role不能为空！')
      return
    }

    let existUser = await $service.baseService.queryOne(user, {username: username})
    if(existUser){
      ctx.body = $helper.Result.fail('-1', '当前用户已存在！')
      return
    }

    let pass = await $helper.createPassword(password)
    let obj = {
      username: username,
      name: name,
      password: pass,
      roles: [role]
    }
    let r = await $service.baseService.save(user, obj)
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '创建用户失败！')
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

})
