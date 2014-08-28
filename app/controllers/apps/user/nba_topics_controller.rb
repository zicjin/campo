class Apps::User::NbaTopicsController < Apps::ApplicationController
  before_action :set_user

  def index
    @topics = @user.nba_topics.includes(:category).order(id: :desc).page(params[:page])
  end

  def likes
    @topics = @user.like_nba_topics.includes(:category, :user).order(id: :desc).page(params[:page])
    render :index
  end

  private

  def set_user
    @user = current_user
  end
end
