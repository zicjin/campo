class GetvideoController < ApplicationController
  before_action :login_required

  def index
    video = Getvideo.parse params['url']
    render json: { flash: video.flash }
  end
end