class AppidController

  def create
    @appid = Appid.new(params[:appid])
    if @appid.save
      render :json => {id: @appid._id}
    end
    render :json => {error: "appid save faild!"}
  end

  def trash
    @appid.trash
  end
  
end
