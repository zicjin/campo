class ApplicationController < ActionController::Base
  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

  helper_method :login?, :current_user, :modern_bower?, :touch_device?

  before_action :set_locale

  private

  class AccessDenied < Exception; end

  def login_required
    unless login?
      redirect_to login_path(return_to: (request.fullpath if request.get?))
    end
  end

  def email_confirmed_required
    if !current_user.confirmed?
      redirect_to new_users_confirmation_path(return_to: (request.fullpath if request.get?))
    end
  end

  def no_locked_required
    if login? and current_user.locked?
      raise AccessDenied
    end
  end

  def no_login_required
    if login?
      redirect_to root_url
    end
  end

  def current_user
    @current_user ||= login_from_session || login_from_cookies unless defined?(@current_user)
    @current_user
  end

  def login?
    !!current_user
  end

  def login_as(user)
    session[:user_id] = user.id
    @current_user = user
  end

  def logout
    session.delete(:user_id)
    @current_user = nil
    forget_me
  end

  def login_from_session
    if session[:user_id].present?
      begin
        User.find session[:user_id]
      rescue
        session[:user_id] = nil
      end
    end
  end

  def login_from_cookies
    if cookies[:remember_token].present?
      if user = User.find_by_remember_token(cookies[:remember_token])
        session[:user_id] = user.id
        user
      else
        forget_me
        nil
      end
    end
  end

  def login_from_access_token
    @current_user ||= User.find_by_access_token(params[:access_token]) if params[:access_token]
  end

  def store_location(path)
    session[:return_to] = path
  end

  def redirect_back_or_default(default)
    redirect_to(session.delete(:return_to) || default)
  end

  def forget_me
    cookies.delete(:remember_token)
    cookies.delete(:customer_name, domain:'.baozoubisai.com')
    cookies.delete(:csrf_token, domain:'.baozoubisai.com')
  end

  def remember_me
    cookies[:remember_token] = {
      value: current_user.remember_token,
      expires: 4.weeks.from_now,
      httponly: true
    }
    cookies[:customer_name] = {
      value: current_user.username,
      expires: 4.weeks.from_now,
      domain: '.baozoubisai.com'
    }
    cookies[:customer_avatar] = {
      value: current_user.avatar.small.url,
      expires: 4.weeks.from_now,
      domain: '.baozoubisai.com'
    }
    cookies[:csrf_token] = {
      value: form_authenticity_token,
      domain: '.baozoubisai.com'
    }
  end

  def set_locale
    I18n.locale = current_user.try(:locale) || http_accept_language.compatible_language_from(I18n.available_locales) || I18n.default_locale
  end

  def parse_preview(content)
    _doc = Nokogiri::HTML(content)

    _embeds = _doc.css("embed")
    if _embeds.length > 0
      begin
        _video = Getvideo.parse _embeds.first['src']
        return _video.cover
      rescue
      end
    end

    _imgs = _doc.css("img")
    if _imgs.length > 0 and _imgs.first['src'].length < 200
      return prevImageName _imgs.first['src']
    end
    # images = doc.css("img").map{|links| links['src']}
  end

  def has_flash?(content)
    _doc = Nokogiri::HTML(content)
    _embeds = _doc.css("embed")
    if _embeds.length > 0
      return true
    end
    return false
  end

  def prevImageName(img)
    prevName = img.gsub(".jpg", "_77.jpg")
    prevName.gsub!(".jpeg", "_77.jpeg")
    prevName.gsub!(".png", "_77.png")
    prevName.gsub!(".gif", "_77.gif")
    return prevName
  end

  def modern_bower?
    unless session[:modern_bower] ||= (request.user_agent !~ /MSIE 7/) && (request.user_agent !~ /MSIE 6/)
      render :action=>'index_old', :layout=>false
    end
  end

  def touch_device?
    session[:touch_device] ||= (request.user_agent =~ /\b(Android|iPhone|iPad|Windows Phone|Kindle|BackBerry)\b/i)
  end

end