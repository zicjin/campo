class ApppushController

  def create
    @apppush = Apppush.new(params[:apppush])
    if @apppush.save
      render :json => {id: @apppush._id}
    end
    render :json => {error: "apppush save faild!"}
  end

  def push
    Resque.enqueue(AppPushJob, @apppush.id)
  end

  def trash
    @apppush.trash
  end
  
end
