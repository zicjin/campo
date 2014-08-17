class Settings::AccountsController < Settings::ApplicationController
  before_action :current_password_required, only: [:update]
  protect_from_forgery except: :update_byjson

  def show
  end

  def update
    if @user.update_attributes params.require(:user).permit(:username, :email)
      flash[:success] = I18n.t('settings.accounts.flashes.successfully_updated')
      redirect_to settings_account_path
    else
      render :show
    end
  end

  def update_byjson
    unless params[:current_password] && @user.authenticate(params[:current_password])
      render :json => {error: I18n.t('settings.flashes.incorrect_current_password')}
    end
    
    if @user.update_attributes params.require(:user).permit(:username, :email)
      render :json => {user: @user}
    else
      render :json => {error: @user.errors.full_messages}
    end
  end
end
