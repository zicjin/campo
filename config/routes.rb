class AdminConstraint
  def self.matches?(request)
    if request.session[:user_id]
      user = User.find request.session[:user_id]
      user && user.admin?
    end
  end
end

Rails.application.routes.draw do
  get 'signup', to: 'users#new', as: 'signup'
  get 'login', to: 'sessions#new', as: 'login'
  post 'login', to: 'sessions#create'
  delete 'logout', to: 'sessions#destroy'
  get 'hot_topics', to: 'topics#hot_byjson'

  post 'app_users', to: 'users#create_byjson'
  post 'app_users_passwords', to: 'users/passwords#creat_byjson'
  post 'app_sessions', to: 'sessions#create_byjson'
  post 'app_settings_accounts', to: 'settings/accounts#update_byjson'
  post 'app_settings_passwords', to: 'settings/passwords#update_byjson'

  resources :appids, only: [:create, :index, :destroy]

  resources :users, only: [:create, :destroy] do
    collection do
      get :check_email
      get :check_username
    end
  end

  namespace :users do
    resource :password, only: [:show, :new, :create, :edit, :update]
    resource :confirmation, only: [:new, :show, :create]
  end

  concern :commentable do
    resources :comments, only: [:create]
  end

  concern :likeable do
    resource :like, only: [:create, :destroy] do
      collection do
        post :create_byjson
        delete :destroy_byjson
      end
    end
  end

  concern :subscribable do
    resource :subscription, only: [:update, :destroy]
  end

  resources :topics, only: [:index, :show, :new, :create, :edit, :update], concerns: [:commentable, :likeable, :subscribable] do
    collection do
      get 'categoried/:category_id', to: 'topics#index', as: :categoried
      get 'search'
    end
    member do
      delete :trash
    end
  end

  resources :nba_topics, only: [:index, :show, :new, :create, :edit, :update], concerns: [:commentable, :likeable, :subscribable] do
    collection do
      get 'categoried/:category_id', to: 'nba_topics#index', as: :categoried
      get 'search'
    end
    member do
      delete :trash
    end
  end

  resources :tennis_topics, only: [:index, :show, :new, :create, :edit, :update], concerns: [:commentable, :likeable, :subscribable] do
    collection do
      get 'categoried/:category_id', to: 'nba_topics#index', as: :categoried
      get 'search'
    end
    member do
      delete :trash
    end
  end

  resources :matches, only: [:index, :show, :edit, :update, :destroy], concerns: [:likeable] do
    collection do
      get  :index_liked
      get  :index_liked_byjson
      post :create_simplify
      post :create_simplify_withlike
    end
  end

  resources :comments, only: [:edit, :update], concerns: [:likeable] do
    member do
      get :cancel
      delete :trash
    end
  end

  resources :notifications, only: [:index, :destroy] do
    collection do
      post :mark
      delete :clear
    end
  end

  resources :attachments, only: [:create]
  resources :getvideo, only: [:index]

  root 'topics#index'

  scope path: '~:username', module: 'users', as: 'user' do
    resources :topics, only: [:index] do
      collection do
        get :likes
      end
    end
    resources :nba_topics, only: [:index] do
      collection do
        get :likes
      end
    end
    resources :tennis_topics, only: [:index] do
      collection do
        get :likes
      end
    end
    resources :comments, only: [:index] do
      collection do
        get :likes
      end
    end
    root to: 'topics#index'
  end

  namespace :apps do
    namespace :user, path: '~:username' do
      resources :topics, only: [:index] do
        collection do
          get :likes
        end
      end
      resources :nba_topics, only: [:index] do
        collection do
          get :likes
        end
      end
      resources :tennis_topics, only: [:index] do
        collection do
          get :likes
        end
      end
      resources :comments, only: [:index] do
        collection do
          get :likes
        end
      end
      root to: 'topics#index'
    end

    resources :comments, only: [:edit, :update], concerns: [:likeable] do
      member do
        get :cancel
        delete :trash
      end
    end

    resources :topics, only: [:index, :show, :new, :create, :edit, :update], concerns: [:commentable, :likeable, :subscribable] do
      collection do
        get 'categoried/:category_id', to: 'topics#index', as: :categoried
        get 'search'
      end
      member do
        delete :trash
      end
    end

    resources :nba_topics, only: [:index, :show, :new, :create, :edit, :update], concerns: [:commentable, :likeable, :subscribable] do
      collection do
        get 'categoried/:category_id', to: 'nba_topics#index', as: :categoried
        get 'search'
      end
      member do
        delete :trash
      end
    end
  end

  namespace :settings do
    resource :account, only: [:show, :update]
    resource :password, only: [:show, :update]
    resource :profile, only: [:show, :update]
    resource :notifications, only: [:show, :update]
  end

  namespace :admin do
    root to: 'dashboard#show'

    resources :users, only: [:index, :show, :update, :destroy] do
      collection do
        get :locked
      end

      member do
        patch :lock
        delete :lock, action: 'unlock'
      end
    end

    resources :categories, except: [:edit]

    resources :topics, only: [:index, :show, :update] do
      collection do
        get :trashed
      end

      member do
        delete :trash
        patch :restore
      end
    end

    resources :nba_topics, only: [:index, :show, :update] do
      collection do
        get :trashed
      end

      member do
        delete :trash
        patch :restore
      end
    end

    resources :tennis_topics, only: [:index, :show, :update] do
      collection do
        get :trashed
      end

      member do
        delete :trash
        patch :restore
      end
    end

    resources :comments, only: [:index, :show, :update] do
      collection do
        get :trashed
      end

      member do
        delete :trash
        patch :restore
      end
    end

    resources :attachments, only: [:index, :destroy]
  end

  constraints(AdminConstraint) do
    mount Resque::Server.new, at: 'resque'
  end

  if Rails.env.development?
    get 'qunit', to: 'qunit#index'
  end
end