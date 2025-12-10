import { useState, useEffect } from 'react'
import { ChefHat, Calendar, User, Star, X, LogOut } from 'lucide-react';
import './App.css'
import { 
  auth, 
  loginWithGoogle, 
  logout, 
  addToFavorites, 
  removeFromFavorites, 
  getFavorites,
  addToMealPlan,
  removeFromMealPlan,
  getMealPlan
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// API Key for Spoonacular
const SPOONACULAR_API_KEY = "dd394e79307844339e5f261fae992b84";

function App() {
  const [activeTab, setActiveTab] = useState('recipes');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [fullRecipeDetails, setFullRecipeDetails] = useState(null);
  const [loadingRecipeDetails, setLoadingRecipeDetails] = useState(false);
  const [showDaySelector, setShowDaySelector] = useState(false);
  
  // User state
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [mealPlan, setMealPlan] = useState({});
  const [favoritesPage, setFavoritesPage] = useState(1);
  const favoritesPerPage = 6;

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Load user's favorites and meal plan
        const userFavorites = await getFavorites(user.uid);
        const userMealPlan = await getMealPlan(user.uid);
        setFavorites(userFavorites);
        setMealPlan(userMealPlan);
      } else {
        setFavorites([]);
        setMealPlan({});
      }
    });

    return () => unsubscribe();
  }, []);

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    number: 100,
    maxReadyTime: 40,
    minHealthScore: 75,
    maxPrice: 500,
    includeNutrition: true,
    addRecipeInformation: true,
    fillIngredients: true,
    instructionsRequired: true,
    sort: 'random'
  });

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = buildSearchParams();
      const response = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`
      );
      
      // Check if quota exceeded or other API error
      if (!response.ok) {
        console.warn('Spoonacular API error, using mock data. Status:', response.status);
        setRecipes(mockRecipes);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      // Check if the response indicates quota exceeded
      if (data.code === 402 || data.status === 'failure') {
        console.warn('Spoonacular API quota exceeded, using mock data');
        setRecipes(mockRecipes);
        setLoading(false);
        return;
      }
      
      const pool = data.results || [];
      
      if (pool.length === 0) {
        console.warn('No recipes returned, using mock data');
        setRecipes(mockRecipes);
      } else {
        const randomRecipes = pool.sort(() => Math.random() - 0.5).slice(0, 6);
        setRecipes(randomRecipes);
      }
    } catch (error) {
      console.error('Error fetching recipes, using mock data:', error);
      setRecipes(mockRecipes);
    }
    setLoading(false);
  };

  useEffect(() => {
    setRecipes(mockRecipes);
  }, []);

  // Fetch full recipe details including instructions
  const fetchFullRecipeDetails = async (recipeId) => {
    setLoadingRecipeDetails(true);
    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=${SPOONACULAR_API_KEY}&includeNutrition=true`
      );
      
      // Check if quota exceeded or other API error
      if (!response.ok) {
        console.warn('Spoonacular API error fetching recipe details. Status:', response.status);
        setLoadingRecipeDetails(false);
        return;
      }
      
      const data = await response.json();
      
      // Check if the response indicates quota exceeded
      if (data.code === 402 || data.status === 'failure') {
        console.warn('Spoonacular API quota exceeded for recipe details');
        setLoadingRecipeDetails(false);
        return;
      }
      
      setFullRecipeDetails(data);
    } catch (error) {
      console.error('Error fetching recipe details:', error);
    }
    setLoadingRecipeDetails(false);
  };

  const handleRecipeClick = async (recipe) => {
    setSelectedRecipe(recipe);
    await fetchFullRecipeDetails(recipe.id);
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAddToFavorites = async (recipe) => {
    if (!user) {
      alert("Please login to add favorites!");
      return;
    }
    
    try {
      const isFavorite = favorites.some(fav => fav.id === recipe.id);
      
      if (isFavorite) {
        await removeFromFavorites(user.uid, recipe.id);
        setFavorites(favorites.filter(fav => fav.id !== recipe.id));
      } else {
        await addToFavorites(user.uid, recipe);
        setFavorites([...favorites, recipe]);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleAddToMealPlan = async (day) => {
    if (!user) {
      alert("Please login to add to meal plan!");
      return;
    }
    
    try {
      await addToMealPlan(user.uid, day, selectedRecipe);
      const updatedMealPlan = await getMealPlan(user.uid);
      setMealPlan(updatedMealPlan);
      setShowDaySelector(false);
      setSelectedRecipe(null);
    } catch (error) {
      console.error("Error adding to meal plan:", error);
    }
  };

  const handleRemoveFromMealPlan = async (day, recipeId) => {
    if (!user) return;
    
    try {
      await removeFromMealPlan(user.uid, day, recipeId);
      const updatedMealPlan = await getMealPlan(user.uid);
      setMealPlan(updatedMealPlan);
    } catch (error) {
      console.error("Error removing from meal plan:", error);
    }
  };

  const handleSearch = () => {
    fetchRecipes();
  };

  // Pagination for favorites
  const totalFavoritesPages = Math.ceil(favorites.length / favoritesPerPage);
  const startIndex = (favoritesPage - 1) * favoritesPerPage;
  const endIndex = startIndex + favoritesPerPage;
  const currentFavorites = favorites.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (favoritesPage < totalFavoritesPages) {
      setFavoritesPage(favoritesPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (favoritesPage > 1) {
      setFavoritesPage(favoritesPage - 1);
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.title.toLowerCase().includes(filterText.toLowerCase())
  );

  const RecipeCard = ({ recipe }) => {
    const isFavorite = favorites.some(fav => fav.id === recipe.id);
    
    return (
      <div className="recipe-card">
        <div 
          onClick={() => handleRecipeClick(recipe)}
          className="recipe-card-clickable"
        >
          <div className="recipe-card-image-container">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="recipe-card-image"
            />
          </div>
          <div className="recipe-card-content">
            <h3 className="recipe-card-title">{recipe.title}</h3>
            <div className="recipe-tags">
              {recipe.tags?.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="recipe-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddToFavorites(recipe);
          }}
          className={`recipe-card-favorite ${isFavorite ? 'favorite-active' : ''}`}
        >
          <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  };

  const RecipeModal = ({ recipe, onClose }) => {
    const isFavorite = favorites.some(fav => fav.id === recipe.id);
    const details = fullRecipeDetails;
    
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <img src={recipe.image} alt={recipe.title} className="modal-image" />
          <div className="modal-body">
            <h2 className="modal-title">{recipe.title}</h2>
            
            <div className="modal-meta">
              <p className="modal-meta-text">
                Ready in: {recipe.readyInMinutes} minutes | Servings: {recipe.servings}
              </p>
            </div>

            {loadingRecipeDetails ? (
              <div className="loading-details">Loading full recipe details...</div>
            ) : details ? (
              <>
                {details.summary && (
                  <div className="modal-section">
                    <h3 className="modal-section-title">Summary</h3>
                    <div
                      className="modal-section-content"
                      dangerouslySetInnerHTML={{ __html: details.summary }}
                    />
                  </div>
                )}

                {details.extendedIngredients && details.extendedIngredients.length > 0 && (
                  <div className="modal-section">
                    <h3 className="modal-section-title">Ingredients</h3>
                    <ul className="ingredients-list">
                      {details.extendedIngredients.map((ingredient, idx) => (
                        <li key={idx} className="ingredient-item">
                          {ingredient.original}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {details.analyzedInstructions && details.analyzedInstructions.length > 0 && (
                  <div className="modal-section">
                    <h3 className="modal-section-title">Instructions</h3>
                    <ol className="instructions-list">
                      {details.analyzedInstructions[0].steps.map((step) => (
                        <li key={step.number} className="instruction-step">
                          <span className="step-number">Step {step.number}</span>
                          <p className="step-text">{step.step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {details.nutrition && (
                  <div className="modal-section">
                    <h3 className="modal-section-title">Nutrition (per serving)</h3>
                    <div className="nutrition-grid">
                      {details.nutrition.nutrients.slice(0, 8).map((nutrient, idx) => (
                        <div key={idx} className="nutrition-item">
                          <span className="nutrient-name">{nutrient.name}</span>
                          <span className="nutrient-value">
                            {Math.round(nutrient.amount)}{nutrient.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              recipe.summary && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Summary</h3>
                  <div
                    className="modal-section-content"
                    dangerouslySetInnerHTML={{ __html: recipe.summary }}
                  />
                </div>
              )
            )}
            
            <div className="modal-buttons">
              <button 
                onClick={() => handleAddToFavorites(recipe)} 
                className='modal-favorite-button'
              > 
                <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
                {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </button>

              <button 
                onClick={() => setShowDaySelector(true)} 
                className='modal-mealplan-button'
              >  
                <Calendar size={15} />
                Add to Meal Plan
              </button>
            </div>

            <button onClick={onClose} className="modal-close-button">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DaySelectorModal = ({ onClose, onSelectDay }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="day-selector-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="day-selector-title">Select a Day</h3>
        <div className="day-selector-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              className="day-selector-button"
            >
              {day}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="day-selector-close">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Home Page (Recipes Lab)</h1>
      </header>

      <nav className="nav-container">
        <div className="nav-tabs">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`nav-tab ${activeTab === 'recipes' ? 'nav-tab-active' : ''}`}
          >
            <ChefHat size={20} />
            <span>Recipes</span>
          </button>
          <button
            onClick={() => setActiveTab('mealplans')}
            className={`nav-tab ${activeTab === 'mealplans' ? 'nav-tab-active' : ''}`}
          >
            <Calendar size={20} />
            <span>Meal Plans</span>
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`nav-tab ${activeTab === 'account' ? 'nav-tab-active' : ''}`}
          >
            <User size={20} />
            <span>My Account</span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'recipes' && (
          <div>
            <div className="recipe-header">
              <div>
                <h2 className="recipe-title">Recommended Recipes</h2>
              </div>
              <div className="filter-container">
                <label className="filter-label">Filter:</label>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Search recipes..."
                  className="filter-input"
                />
              </div>
            </div>

            {loading ? (
              <div className="loading-state">Loading recipes...</div>
            ) : (
              <div className="recipe-grid">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            )}

            <div className="refresh-button-container">
              <button onClick={fetchRecipes} className="refresh-button">
                Get New Recommendations
              </button>
            </div>
          </div>
        )}

        {activeTab === 'mealplans' && (
          <div className="section-container">
            <h2 className="section-title">Meal Plans</h2>
            <p className="section-description">Plan your meals for the week!</p>
            {user ? (
              <div className="meal-plan-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="meal-plan-day">
                    <h3 className="meal-plan-day-title">{day}</h3>
                    <div className="meal-plan-day-content">
                      {mealPlan[day]?.length > 0 ? (
                        mealPlan[day].map((recipe) => (
                          <div key={recipe.id} className="meal-plan-recipe">
                            <span 
                              onClick={() => handleRecipeClick(recipe)}
                              className="meal-plan-recipe-title"
                            >
                              {recipe.title}
                            </span>
                            <button
                              onClick={() => handleRemoveFromMealPlan(day, recipe.id)}
                              className="meal-plan-remove"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <span>No meals planned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="login-prompt">Please login to view your meal plan</p>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div className="section-container">
            <h2 className="section-title">My Account</h2>
            {user ? (
              <div className="account-content">
                <div className="user-profile">
                  <img src={user.photoURL} alt={user.displayName} className="user-avatar" />
                  <h3>{user.displayName}</h3>
                  <p>{user.email}</p>
                  <button onClick={handleLogout} className="logout-button">
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
                
                <div className="favorites-section">
                  <div className="favorites-header">
                    <h3 className="section-subtitle">My Favorites ({favorites.length})</h3>
                  </div>
                  
                  {favorites.length === 0 ? (
                    <p className="no-favorites">No favorites yet. Start adding some recipes!</p>
                  ) : (
                    <>
                      <div className="recipe-grid">
                        {currentFavorites.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                      
                      {totalFavoritesPages > 1 && (
                        <div className="pagination-container">
                          <button 
                            onClick={handlePrevPage} 
                            disabled={favoritesPage === 1}
                            className="pagination-button"
                          >
                            Previous
                          </button>
                          <span className="pagination-info">
                            Page {favoritesPage} of {totalFavoritesPages}
                          </span>
                          <button 
                            onClick={handleNextPage} 
                            disabled={favoritesPage === totalFavoritesPages}
                            className="pagination-button"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="login-container">
                <p className="section-description">Login to manage your profile and save favorites</p>
                <button onClick={handleLogin} className="login-button">
                  Login with Google
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedRecipe && !showDaySelector && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => {
            setSelectedRecipe(null);
            setFullRecipeDetails(null);
          }}
        />
      )}

      {showDaySelector && (
        <DaySelectorModal
          onClose={() => setShowDaySelector(false)}
          onSelectDay={handleAddToMealPlan}
        />
      )}
    </div>
  );
}

const mockRecipes = [
  {
    id: 1,
    title: 'Spaghetti Carbonara',
    image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400',
    tags: ['Italian', 'Pasta'],
    readyInMinutes: 30,
    servings: 4,
    summary: 'A classic Italian pasta dish made with eggs, cheese, and bacon.'
  },
  {
    id: 2,
    title: 'Chicken Tikka Masala',
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',
    tags: ['Indian', 'Curry'],
    readyInMinutes: 45,
    servings: 6,
    summary: 'Tender chicken in a creamy, spiced tomato sauce.'
  },
  {
    id: 3,
    title: 'Caesar Salad',
    image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400',
    tags: ['Salad', 'Healthy'],
    readyInMinutes: 15,
    servings: 2,
    summary: 'Fresh romaine lettuce with classic Caesar dressing and croutons.'
  },
  {
    id: 4,
    title: 'Beef Tacos',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
    tags: ['Mexican', 'Quick'],
    readyInMinutes: 25,
    servings: 4,
    summary: 'Seasoned ground beef in crispy taco shells with fresh toppings.'
  },
  {
    id: 5,
    title: 'Mushroom Risotto',
    image: 'https://images.unsplash.com/photo-1476124369491-c404fae0a326?w=400',
    tags: ['Italian', 'Vegetarian'],
    readyInMinutes: 40,
    servings: 4,
    summary: 'Creamy Italian rice dish with savory mushrooms and parmesan.'
  },
  {
    id: 6,
    title: 'Chocolate Chip Cookies',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400',
    tags: ['Dessert', 'Baking'],
    readyInMinutes: 20,
    servings: 24,
    summary: 'Classic homemade cookies with melty chocolate chips.'
  }
];

export default App;