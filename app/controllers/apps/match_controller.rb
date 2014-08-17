class Apps::MatchController < ApplicationController
  before_action :set_user

  def add_likematch
    match = Matchs.find params[:matchId]

  end

  def remove_likematch

  end

  private

  def set_user
    @user = current_user
  end

end