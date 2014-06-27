class Admin::TennisTopicsController < Admin::ApplicationController
  before_action :find_topic, only: [:show, :update, :trash, :restore]
  before_action :topic_categories, only: [:show]

  def index
    @topics = TennisTopic.includes(:user).order(id: :desc).page(params[:page])
  end

  def trashed
    @topics = TennisTopic.trashed.includes(:user).order(id: :desc).page(params[:page])
    render :index
  end

  def show
  end

  def update
    if @topic.update_attributes params.require(:topic).permit(:title, :category_id, :body)
      flash[:success] = I18n.t('admin.topics.flashes.successfully_updated')
      redirect_to admin_tennis_topic_url(@topic)
    else
      render :show
    end
  end

  def trash
    @topic.trash
    flash[:success] = I18n.t('admin.topics.flashes.successfully_trashed')
    redirect_to admin_tennis_topic_path(@topic)
  end

  def restore
    @topic.restore
    flash[:success] = I18n.t('admin.topics.flashes.successfully_restored')
    redirect_to admin_tennis_topic_path(@topic)
  end

  private

  def find_topic
    @topic = TennisTopic.with_trashed.find params[:id]
  end

  def topic_categories
    @categories = Category.where(group: 2)
  end
end