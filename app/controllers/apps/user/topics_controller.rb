class Apps::User::TopicsController < Apps::ApplicationController
  before_action :set_user

  def index
    @topics = @user.topics.includes(:category).where(hasflash: [nil, false]).order(id: :desc).page(params[:page])
  end

  def likes
    @topics = @user.like_topics.includes(:category, :user).order(id: :desc).page(params[:page])
    render :index
  end

  private

  def set_user
    @user = current_user
  end

end