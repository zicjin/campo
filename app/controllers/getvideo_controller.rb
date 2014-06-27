class GetvideoController < ApplicationController
  before_action :login_required

  def index
    _video = Getvideo.parse params['url']

    render json: { flash: @video.flash }
  end
end