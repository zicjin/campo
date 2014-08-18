class Apps::User::CommentsController < ApplicationController
  layout 'app'

  def index
  	@user = current_user
    @comments = @user.comments.includes(:commentable).order(id: :desc).page(params[:page])
  end

  def likes
  	@user = current_user
    @comments = @user.like_comments.includes(:commentable, :user).order(id: :desc).page(params[:page])
    render :index
  end
end
