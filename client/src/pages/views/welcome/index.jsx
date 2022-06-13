import React, {useState} from "react";
import "./index.styl";

import {Button} from "antd";

const Index = () => {
  return (
    <div className="welcome-container">
      <div className="welcome-wrap FBV">
        <span className="welcome-title">11</span>

        <Button
          type="primary"
          size="large"
          style={{width: '120px'}}
          onClick={
            ()=>{
            }
          }
        >
          创建玩家
        </Button>
        <Button
          type="primary"
          size="large"
          style={{width: '120px'}}
          onClick={
            ()=>{
            }
          }
        >
          退出登录
        </Button>
      </div>
    </div>
  )
}
export default Index
