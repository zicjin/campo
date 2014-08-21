class MatchesController < ApplicationController
  before_action :find_macth, only: [:show, :edit, :update, :destroy]
  before_action :login_required, :no_locked_required, except: [:index, :show]
  protect_from_forgery except: [:create_simplify, :create_simplify_withlike]

  def index
  end

  def show
  end

  def index_liked
    matches = current_user.like_matches.page params[:page]
  end

  def index_liked_byjson
    matches = current_user.like_matches
    render :json => matches.map { |m| m.mongo_id }
  end

  def create_simplify
    _params = match_params
    Match.where(mongo_id: _params[:mongo_id]).first_or_create _params
  end

  def create_simplify_withlike
    match = create_simplify
    match.likes.find_or_create_by user: current_user
    render :json => {result: 'ok'}
  end

  def edit
  end

  def update
  end

  def destroy
    @match.trash
  end

  private

  def find_macth
    @match = Match.find params[:id]
  end

  def match_params
    params.require(:match).permit(:mongo_id, :time, :type)
  end

end