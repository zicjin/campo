USER=`zcj`
APP_ROOT=/home/zcj/www/d.baozoubisai.com

# Production environment
sudo mkdir -p $APP_ROOT
sudo chown $USER:$USER $APP_ROOT
sudo mkdir -p $APP_ROOT/shared/config
sudo cp config/database.example.yml $APP_ROOT/shared/config/database.yml
sudo cp config/secrets.example.yml $APP_ROOT/shared/config/secrets.yml
sudo cp config/config.example.yml $APP_ROOT/shared/config/config.yml
sed -i "s/secret_key_base: \w\+/secret_key_base: `bundle exec rake secret`/g" $APP_ROOT/shared/config/secrets.yml

# Resque init script
sudo cp config/resque.example.sh /etc/init.d/resque
sudo chmod +x /etc/init.d/resque
sudo sed -i "s|APP_ROOT=.\+|APP_ROOT=$APP_ROOT/current|" /etc/init.d/resque
sudo sed -i "s/USER=\w\+/USER=$USER/" /etc/init.d/resque
sudo update-rc.d resque defaults

# Nginx config
sudo cp config/nginx.example.conf /etc/nginx/sites-available/campo
sudo sed -i "s|root .\+;|root $APP_ROOT/current/public;|" /etc/nginx/sites-available/campo
sudo ln -s /etc/nginx/sites-available/campo /etc/nginx/sites-enabled
sudo service nginx restart
