import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/main/HomeScreen';
import InventoryScreen from '../screens/main/InventoryScreen';
import RecipesScreen from '../screens/main/RecipesScreen';
import RecipeDetailScreen from '../screens/main/RecipeDetailScreen';
import MealPlansScreen from '../screens/main/MealPlansScreen';
import GroceryListScreen from '../screens/main/GroceryListScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import MobileTabBar from './MobileTabBar';
import { colors, typography } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  Inventory: undefined;
  Recipes: undefined;
  MealPlans: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  RecipeDetail: { recipeId: string };
  GroceryList: undefined;
  Chat: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <MobileTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
          fontFamily: typography.fontDisplay,
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Pantry' }} />
      <Tab.Screen name="Recipes" component={RecipesScreen} />
      <Tab.Screen name="MealPlans" component={MealPlansScreen} options={{ title: 'Meal Plans' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const sharedStackOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
  },
  headerTintColor: colors.foreground,
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: colors.background,
  },
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontFamily: typography.fontDisplay,
  },
};

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={sharedStackOptions}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ title: 'Recipe Details' }}
      />
      <Stack.Screen
        name="GroceryList"
        component={GroceryListScreen}
        options={{ title: 'Grocery List' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'AI Chef' }}
      />
    </Stack.Navigator>
  );
}
