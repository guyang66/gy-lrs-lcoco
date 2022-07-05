#!/bin/bash
# 暂存目录
tarName="lcoco"
projectName="gy-lrs-lcoco"
#npm run build
cd ..
ls
echo "${tarPath}.tgz"
tar_name="${tarName}.tgz"
# 压缩目录
echo "$tar_name ${projectName}"
tar -zcvf $tar_name ${projectName}
echo "\033[1;32m 压缩完成! 可使用scp命令进行上传：scp tgz/${tar_name} xxxxx"
