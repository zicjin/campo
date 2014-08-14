class Apps::PasswordsController < ApplicationController
  layout 'app'
  before_action :set_user
  before_action :current_password_required, only: [:update]

  def show
  end

  def update
    if @user.update_attributes params.require(:user).permit(:password, :password_confirmation)
      flash[:success] = I18n.t('settings.passwords.flashes.successfully_updated')
      redirect_to settings_password_url
    else
      render :show
    end
  end

  private

  def set_user
    @user = current_user
  end

  def current_password_required
    unless params[:current_password] && @user.authenticate(params[:current_password])
      flash.now[:warning] = I18n.t('settings.flashes.incorrect_current_password')
      render :show
    end
  end
end
