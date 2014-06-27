class NbaTopicsController < ApplicationController
  before_action :login_required, :no_locked_required, except: [:index, :show, :search]
  before_action :find_topic, only: [:edit, :update, :trash]
  before_action :topic_categories, only: [:new, :edit]

  def index
    @topics = NbaTopic.includes(:user, :category).page(params[:page])

    if params[:category_id]
      @category = Category.where('lower(slug) = ?', params[:category_id].downcase).first!
      @topics = @topics.where(category: @category)
    end

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
    @topics = NbaTopic.search(
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
    @topic = NbaTopic.find params[:id]

    if params[:comment_id] and comment = @topic.comments.find_by(id: params.delete(:comment_id))
      params[:page] = comment.page
    end

    @comments = @topic.comments.includes(:user).order(id: :asc).page(params[:page])

    respond_to do |format|
      format.html
    end
  end

  def new
    # binding.pry
    @category = Category.where('lower(slug) = ?', params[:category_id].downcase).where(group: 1).first if params[:category_id].present?
    @topic = NbaTopic.new category: @category
  end

  def create
    _params = topic_params
    _params[:preview] = parse_preview _params[:body]
    @topic = current_user.nba_topics.create _params
  end

  def edit
  end

  def update
    _params = topic_params
    _params[:preview] = parse_preview _params[:body]
    @topic.update_attributes _params
  end

  def trash
    @topic.trash
    redirect_via_turbolinks_to nba_topics_path
  end

  private

  def topic_params
    params.require(:nba_topic).permit(:title, :category_id, :body)
  end

  def find_topic
    @topic = current_user.nba_topics.find params[:id]
  end

  def topic_categories
    @categories = Category.where(group: 1)
  end

  def parse_preview(content)
    _doc = Nokogiri::HTML(content)

    _embeds = _doc.css("embed")
    if _embeds.length > 0
      _video = Getvideo.parse _embeds.first['src']
      return _video.cover
    end

    _imgs = _doc.css("img")
    if _imgs.length > 0
      return _imgs.first['src']
    end
  end

end