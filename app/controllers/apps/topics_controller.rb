class Apps::TopicsController < Apps::ApplicationController
  before_action :login_required, :no_locked_required, except: [:index, :show, :search]
  before_action :find_topic, only: [:edit, :update, :trash]
  before_action :topic_categories, only: [:new, :edit]

  def index
    @topics = Topic.includes(:user, :category).page(params[:page])

    if params[:category_id]
      @category = Category.where('lower(slug) = ?', params[:category_id].downcase).first!
      @topics = @topics.where(category: @category)
    end

    @topics = @topics.where(hasfalsh: false)

    # Set default tab
    unless %w(hot newest).include? params[:tab]
      params[:tab] = 'hot'
    end

    case params[:tab]
    when 'hot'
      @topics = @topics.order(hot: :desc)
    when 'newest'
      @topics = @topics.order(id: :desc)
    end
  end

  def search
    @topics = Topic.search(
      query: {
        multi_match: {
          query: params[:q].to_s,
          fields: ['title', 'body']
        }
      },
      filter: {
        term: {
          trashed: false
        }
      }
    ).page(params[:page]).records
  end

  def show
    @topic = Topic.find params[:id]
    @category = @topic.category
    if params[:comment_id] and comment = @topic.comments.find_by(id: params.delete(:comment_id))
      params[:page] = comment.page
    end

    @comments = @topic.comments.includes(:user).order(id: :asc).page(params[:page])

    respond_to do |format|
      format.html
    end
  end

  def new
    @category = Category.where('lower(slug) = ?', params[:category_id].downcase).first if params[:category_id].present?
    @topic = Topic.new category: @category
  end

  def create
    _params = topic_params
    _params[:preview] = parse_preview _params[:body]
    _params[:hasflash] = has_flash? _params[:body]
    @topic = current_user.topics.create _params
  end

  def edit
  end

  def update
    _params = topic_params
    _params[:preview] = parse_preview _params[:body]
    _params[:hasflash] = has_flash? _params[:body]
    @topic.update_attributes _params
  end

  def trash
    @topic.trash
    redirect_via_turbolinks_to apps_topics_path
  end

  private

  def topic_params
    params.require(:topic).permit(:title, :category_id, :body)
  end

  def find_topic
    @topic = current_user.topics.find params[:id]
  end

  def topic_categories
    @categories = Category.where(group: 0)
  end

end

