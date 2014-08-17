class SessionsController < ApplicationController
  before_action :no_login_required, :access_limiter, only: [:new, :create]
  protect_from_forgery except: :create_byjson

  def new
    store_location params[:return_to]
  end

  def create
    login = params[:login].downcase
    @user = if login.include?('@')
              User.where('lower(email) = ?', login).first
            else
              User.where('lower(username) = ?', login).first
            end

    if @user && @user.authenticate(params[:password])
      login_as @user
      remember_me
      redirect_back_or_default root_url
    else
      flash[:warning] = I18n.t('sessions.flashes.incorrect_user_name_or_password')
      redirect_to login_url
    end
  end

  def create_byjson
    login = params[:login].downcase
    @user = if login.include?('@')
              User.where('lower(email) = ?', login).first
            else
              User.where('lower(username) = ?', login).first
            end

    if @user && @user.authenticate(params[:password])
      render :json => {remember_token: @user.remember_token, username: @user.username, email: @user.email}
    else
      render :json => {error: "错误的用户名或密码"}
    end
  end

  def destroy
    logout
    redirect_to root_url
  end

  private

  def access_limiter
    key = "sessions:limiter:#{request.remote_ip}"
    if $redis.get(key).to_i > 4
      render :access_limiter
    elsif action_name != 'new' # get login page not incr limiter
      $redis.incr(key)
      if $redis.ttl(key) == -1
        $redis.expire(key, 60)
      end
    end
  end
end