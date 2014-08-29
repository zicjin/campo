class AttachmentsController < ApplicationController
  before_action :login_required

  def create
    @attachment = current_user.attachments.create params.require(:attachment).permit(:file)
    inputName = @attachment.file.file.file
    image = MiniMagick::Image.open inputName
    image.resize "200x77"
    outputName = prevImageName inputName
    image.write outputName
    render json: { file_path: @attachment.file.url }
  end
end