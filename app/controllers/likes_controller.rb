class LikesController < ApplicationController
  before_action :login_required, :no_locked_required, :find_likeable
  protect_from_forgery except: [:create_byjson, :destroy_byjson]

  def create
    @likeable.likes.find_or_create_by user: current_user
  end

  def create_byjson
    @likeable.likes.find_or_create_by user: current_user
    render :json => {result: 'ok'}
  end

  def destroy
    @likeable.likes.where(user: current_user).destroy_all
  end

  def destroy_byjson
    @likeable.likes.where(user: current_user).destroy_all
    render :json => {result: 'ok'}
  end

  private

  def find_likeable
    resource, id = request.path.split('/')[1, 2]
    if resource == "matches"
      @likeable = resource.singularize.classify.constantize.find_by(mongo_id: id)
    else
      @likeable = resource.singularize.classify.constantize.find(id)
    end
  end
end
