class Users::NbaTopicsController < Users::ApplicationController
  def index
    @topics = @user.nba_topics.includes(:category).order(id: :desc).page(params[:page])
  end

  def likes
    @topics = @user.like_nba_topics.includes(:category, :user).order(id: :desc).page(params[:page])
    render :index
  end
end
