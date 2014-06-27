class Users::TennisTopicsController < Users::ApplicationController
  def index
    @topics = @user.tennis_topics.includes(:category).order(id: :desc).page(params[:page])
  end

  def likes
    @topics = @user.like_tennis_topics.includes(:category, :user).order(id: :desc).page(params[:page])
    render :index
  end
end
