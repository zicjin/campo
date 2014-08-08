class AppidsController < ActionController::Base

  def create
    @appid = Appid.new appid_params
    @appid.last_login = DateTime.now
    binding.pry
    if @appid.save
      render :json => {id: @appid._id.to_s}
    else
      render :json => {error: @appid.errors.full_messages}
    end

    if Appid.where(idstring: @appid.idstring).exists?
      exit = Appid.find_by(idstring: @appid.idstring)
      exit.update_attributes appid_params
      exit.last_login = DateTime.now
      exit.save
    end
  end

  def index
    @appids = Appid.all.order(last_login: :desc).page(params[:page])
  end
  
  def destroy
    @appids = Appid.find params[:id]
    @appids.destroy
  end

  private
  
  def appid_params
    params.require(:appid).permit(:idstring, :type, :app_ver, :os_ver, :device_info)
  end

end
