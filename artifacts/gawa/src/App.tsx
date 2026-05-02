import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import EventsList from "@/pages/events/index";
import EventCreate from "@/pages/events/new";
import EventDetail from "@/pages/events/detail";
import EventShare from "@/pages/events/share";
import TripsList from "@/pages/trips/index";
import TripDetail from "@/pages/trips/detail";
import RecurringList from "@/pages/recurring/index";
import ActivityFeed from "@/pages/activity/index";
import ContactsList from "@/pages/contacts/index";
import GroupsList from "@/pages/groups/index";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/share/:id" component={EventShare} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/events" component={EventsList} />
            <Route path="/events/new" component={EventCreate} />
            <Route path="/events/:id" component={EventDetail} />
            <Route path="/trips" component={TripsList} />
            <Route path="/trips/:id" component={TripDetail} />
            <Route path="/recurring" component={RecurringList} />
            <Route path="/contacts" component={ContactsList} />
            <Route path="/groups" component={GroupsList} />
            <Route path="/activity" component={ActivityFeed} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
