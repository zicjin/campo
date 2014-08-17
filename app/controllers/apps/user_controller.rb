class Apps::MatchController < ApplicationController
  before_action :set_user

  def add_likematch
    @topics = @user.topics.includes(:category).order(id: :desc).page(params[:page])
  end

  def remove_likematch
    @topics = @user.like_topics.includes(:category, :user).order(id: :desc).page(params[:page])
    render :index
  end

  private

  def set_user
    @user = current_user
  end

end