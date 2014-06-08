#!/usr/bin/env bash

USER=`zcj`
APP_ROOT=/var/www/baozou-dis

sudo apt-get update

# Install system packages
# DEBIAN_FRONTEND=noninteractive 非交互式
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server memcached git-core nodejs imagemagick postfix

# Install Elasticsearch
wget -O - http://packages.elasticsearch.org/GPG-KEY-elasticsearch | sudo apt-key add -
sudo bash -c "echo 'deb http://packages.elasticsearch.org/elasticsearch/1.0/debian stable main' > /etc/apt/sources.list.d/elasticsearch.list"
sudo apt-get update
sudo apt-get install -y openjdk-7-jre-headless elasticsearch
sudo update-rc.d elasticsearch defaults
sudo service elasticsearch start

# Install PostgreSQL
sudo apt-get install -y postgresql libpq-dev
sudo su postgres -c "createuser -d -R -S $USER"

# Install Passenger. 支持ruby的web服务器。
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 561F9B9CAC40B2F7
sudo apt-get install -y apt-transport-https ca-certificates #-y, --yes Assume yes to all queries
sudo bash -c "echo 'deb https://oss-binaries.phusionpassenger.com/apt/passenger precise main' > /etc/apt/sources.list.d/passenger.list"
sudo apt-get update
sudo apt-get install -y nginx-extras passenger

# Install rvm and ruby
sudo apt-get install -y curl
curl -sSL https://get.rvm.io | bash -s stable
source ~/.rvm/scripts/rvm
rvm install 2.1.1
rvm use --default 2.1.1

# Development environment
cp config/database.example.yml config/database.yml
cp config/secrets.example.yml config/secrets.yml
cp config/config.example.yml config/config.yml
bundle install
bundle exec rake db:create:all db:setup

# Production environment
sudo mkdir -p $APP_ROOT
sudo chown $USER:$USER $APP_ROOT
mkdir -p $APP_ROOT/shared/config
cp config/database.example.yml $APP_ROOT/shared/config/database.yml
cp config/secrets.example.yml $APP_ROOT/shared/config/secrets.yml
cp config/config.example.yml $APP_ROOT/shared/config/config.yml
# sed是非交互式的编辑器，逐行处理文件，并将结果发送到屏幕。默认不修改原始文件，-i表示直接对目标文件操作，-n仅显示处理后的结果
sed -i "s/secret_key_base: \w\+/secret_key_base: `bundle exec rake secret`/g" $APP_ROOT/shared/config/secrets.yml #s/x/y/ 表示x替换为y字符串。g表示当前行全局匹配

# Resque init script
sudo cp config/resque.example.sh /etc/init.d/resque
sudo chmod +x /etc/init.d/resque
sudo sed -i "s|APP_ROOT=.\+|APP_ROOT=$APP_ROOT/current|" /etc/init.d/resque #没有g，使用 |……|……| 表示非全局匹配
sudo sed -i "s/USER=\w\+/USER=$USER/" /etc/init.d/resque
sudo update-rc.d resque defaults

# Nginx config
sudo cp config/nginx.example.conf /etc/nginx/sites-available/campo
sudo sed -i "s|root .\+;|root $APP_ROOT/current/public;|" /etc/nginx/sites-available/campo
sudo ln -s /etc/nginx/sites-available/campo /etc/nginx/sites-enabled
sudo rm /etc/nginx/sites-enabled/default
sudo sed -i 's/# passenger_root/passenger_root/' /etc/nginx/nginx.conf
sudo sed -i "s|# passenger_ruby .\+;|passenger_ruby /home/$USER/.rvm/wrappers/default/ruby;|" /etc/nginx/nginx.conf
sudo service nginx restart